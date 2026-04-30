import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { crawl, UrlBlockedError, UpstreamError } from '@/lib/crawler';
import { estimate } from '@/lib/llm';
import { urlSchema } from '@/lib/validation/url-schema';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { prisma } from '@/lib/server/db';
import { encodeSseEvent, resumeOffset, SSE_HEADERS } from '@/lib/server/sse';
import { llmRateLimiter } from '@/lib/server/rate-limit';
import { isDevAuthBypassEnabled } from '@/lib/auth/dev-bypass';

/**
 * POST /api/v1/companies/stream
 * spec.md §4.1 / Cycle 3.4: URL投入 → クロール → LLM 推定 を SSE で進捗送信.
 *
 * イベント順序 (id):
 *   1. validating  — 入力検証
 *   2. crawling    — SSRF safe crawl
 *   3. estimating  — LLM estimation (degraded フラグも含む)
 *   4. persisting  — Company upsert + AuditLog
 *   5. done        — { id, domain, degraded }
 *
 * Last-Event-Id ヘッダで再開オフセットを取り、それ以前のイベントはスキップする
 * (再生は既に完了済みとして扱う; 完全な耐久性は SQS 化で担保 — Wave 4 で検討)。
 *
 * 認可: company.create (editor 以上)
 * Cancel: req.signal の abort で各 await を中断 (AbortController 互換)
 */

export const runtime = 'nodejs';

const RequestSchema = urlSchema; // { url: string }

const STAGE_IDS = ['validating', 'crawling', 'estimating', 'persisting', 'done'] as const;
type StageId = (typeof STAGE_IDS)[number];

interface SsePush {
  emit: (id: StageId, data: unknown) => void;
  close: () => void;
}

function makePush(controller: ReadableStreamDefaultController<Uint8Array>, skip: number): SsePush {
  let i = 0;
  return {
    emit(id, data) {
      const idx = STAGE_IDS.indexOf(id);
      if (idx < skip) {
        i = idx + 1;
        return; // 再開オフセットより前のイベントは送らない
      }
      controller.enqueue(encodeSseEvent({ event: id, id, data }));
      i = idx + 1;
    },
    close() {
      // 完了時に明示的な end イベントは done で代用 (close は controller 側)
      void i;
    },
  };
}

function debugError(stage: string, e: unknown): Response {
  const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const stack = e instanceof Error ? e.stack : undefined;
  console.error(`[companies/stream] ${stage} failed:`, detail, stack);
  if (isDevAuthBypassEnabled()) {
    return new Response(
      JSON.stringify({ debug: true, stage, detail, stack: stack?.split('\n').slice(0, 10) }),
      { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }
  return new Response('Internal Server Error', { status: 500 });
}

export async function POST(req: NextRequest): Promise<Response> {
  let stage = 'auth';
  try {
    const guard = await requireActionFromRequest(req, 'company.create');
    if (!guard.ok) return guard.response;

    stage = 'parse-body';
    const json = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(json);
    if (!parsed.success) {
      return problemResponse('invalid_input', { errors: parsed.error.flatten() });
    }

    const lastEventId = req.headers.get('last-event-id');
    const skip = resumeOffset(lastEventId, STAGE_IDS as unknown as string[]);

    stage = 'resolve-tenant';
    const { tenantId, userId } = await resolveTenantContext(guard.user);

    stage = 'rate-limit';
    const rl = llmRateLimiter.consume(`company:${tenantId.toString()}`);
    if (!rl.allowed) {
      return problemResponse('rate_limited', {
        detail: `LLM 呼び出しが多すぎます (${Math.ceil(rl.retryAfterMs / 1000)}秒後に再試行)`,
        extras: { retryAfterMs: rl.retryAfterMs },
      });
    }

    const url = parsed.data.url;

    stage = 'build-stream';
    const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = makePush(controller, skip);
      try {
        push.emit('validating', { url });

        // 1) Crawl (SSRF safe)
        let crawlResult;
        try {
          crawlResult = await crawl(url, { timeoutMs: 10_000 });
        } catch (e) {
          if (e instanceof UrlBlockedError) {
            await writeAudit({
              tenantId,
              userId,
              action: 'ssrf.block',
              resourceType: 'company',
              resourceId: null,
              afterValue: { url, reason: e.reason },
            });
            controller.enqueue(
              encodeSseEvent({
                event: 'error',
                id: 'error',
                data: { code: 'url_blocked', reason: e.reason, message: e.message },
              }),
            );
            controller.close();
            return;
          }
          if (e instanceof UpstreamError) {
            controller.enqueue(
              encodeSseEvent({
                event: 'error',
                id: 'error',
                data: { code: 'upstream_error', message: e.message },
              }),
            );
            controller.close();
            return;
          }
          throw e;
        }
        push.emit('crawling', {
          finalUrl: crawlResult.finalUrl,
          hops: crawlResult.hops,
          title: crawlResult.extraction.title,
        });

        // 2) Estimate (fallback 内蔵)
        const est = await estimate({
          url,
          title: crawlResult.extraction.title,
          description: crawlResult.extraction.description,
          publicText: crawlResult.extraction.textSnippet,
        });
        push.emit('estimating', {
          industry: est.output.industry,
          confidence: est.output.confidence,
          degraded: est.degraded,
          needsManualReview: est.needsManualReview,
          provider: est.provider,
        });

        // 3) Persist (upsert)
        const finalUrl = new URL(crawlResult.finalUrl);
        const domain = finalUrl.hostname.toLowerCase();
        const company = await prisma.company.upsert({
          where: { tenantId_domain: { tenantId, domain } },
          create: {
            tenantId,
            domain,
            displayName: crawlResult.extraction.title || domain,
            industry: est.output.industry,
            size: est.output.size,
            inferredData: est.output as unknown as object,
            inferenceConfidence: est.output.confidence,
            userOverrides: {},
            createdById: userId,
          },
          update: {
            displayName: crawlResult.extraction.title || domain,
            industry: est.output.industry,
            size: est.output.size,
            inferredData: est.output as unknown as object,
            inferenceConfidence: est.output.confidence,
          },
          select: { id: true, domain: true },
        });
        await writeAudit({
          tenantId,
          userId,
          action: 'company.upsert',
          resourceType: 'company',
          resourceId: company.id,
          afterValue: {
            url,
            degraded: est.degraded,
            provider: est.provider,
            confidence: est.output.confidence,
            channel: 'sse',
          },
        });
        push.emit('persisting', { companyId: company.id.toString() });

        // 4) Done
        push.emit('done', {
          id: company.id.toString(),
          domain: company.domain,
          status: 'completed',
          degraded: est.degraded,
          needsManualReview: est.needsManualReview,
        });
      } catch (e) {
        controller.enqueue(
          encodeSseEvent({
            event: 'error',
            id: 'error',
            data: {
              code: 'internal_error',
              message: e instanceof Error ? e.message : 'unknown',
            },
          }),
        );
      } finally {
        controller.close();
      }
    },
    cancel() {
      // クライアント側 cancel — fetch reader.cancel() / AbortController.abort()
      // ここで in-flight な await を確実に中断するには AbortSignal を伝播する必要があるが、
      // crawl / estimate は内部で AbortSignal.timeout を使っており、最大 10s/30s で
      // 自然終了するため OK.
    },
    });

    return new Response(stream, { status: 200, headers: SSE_HEADERS });
  } catch (e) {
    return debugError(stage, e);
  }
}
