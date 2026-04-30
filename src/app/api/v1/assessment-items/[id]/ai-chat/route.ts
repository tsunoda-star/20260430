import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { prisma } from '@/lib/server/db';
import { streamAiChat, sanitizeAiChatMarkdown } from '@/lib/llm';
import { llmRateLimiter } from '@/lib/server/rate-limit';

/**
 * POST /api/v1/assessment-items/:id/ai-chat
 * spec.md §4.3 / §8.3: SSE で AI 回答をストリーム配信し、完了時に永続化.
 *
 * - note / evidenceUrl は LLM コンテキストに含めない (PII 除外, §8.5)
 * - sanitizeAiChatMarkdown を完了時に適用 (§8.6 XSS 対策)
 * - 認可: ai_chat.ask (owner / admin / editor / reviewer)
 *
 * Response:
 *   Content-Type: text/event-stream
 *     event: chunk\n data: { "delta": "..." }\n\n
 *     event: meta\n  data: { "aiChatId": "...", "promptVersion": "...", "degraded": false }\n\n
 *     event: done\n  data: {}\n\n
 */

export const runtime = 'nodejs';

const RequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
});

function parseId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'ai_chat.ask');
  if (!guard.ok) return guard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  const { tenantId, userId } = await resolveTenantContext(guard.user);

  const rl = llmRateLimiter.consume(`ai-chat:${tenantId.toString()}`);
  if (!rl.allowed) {
    return problemResponse('rate_limited', {
      detail: `AI チャットの呼び出しが多すぎます (${Math.ceil(rl.retryAfterMs / 1000)}秒後に再試行)`,
      extras: { retryAfterMs: rl.retryAfterMs },
    });
  }

  // ITEM-CONTEXT を構築するため AssessmentItem + ControlItem + GuidelineVersion + Guideline を取得
  const item = await prisma.assessmentItem.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      controlItem: {
        select: {
          category: true,
          subCategory: true,
          title: true,
          description: true,
          references: true,
          guidelineVersion: {
            select: {
              version: true,
              guideline: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!item) return problemResponse('not_found');

  const ctxItem = item.controlItem;
  const ctxVersion = ctxItem.guidelineVersion;
  const referencesExcerpt = ctxItem.references
    ? JSON.stringify(ctxItem.references).slice(0, 4000)
    : '';

  const stream = await streamAiChat(
    {
      item: {
        guidelineName: ctxVersion.guideline.name,
        guidelineVersion: ctxVersion.version,
        category: ctxItem.category,
        subCategory: ctxItem.subCategory,
        controlTitle: ctxItem.title,
        controlDescription: ctxItem.description,
        referencesExcerpt,
      },
      question: parsed.data.question,
    },
    { signal: req.signal },
  );

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      let accumulated = '';
      try {
        for await (const delta of stream.chunks) {
          accumulated += delta;
          controller.enqueue(encoder.encode(sseEvent('chunk', { delta })));
        }
        const summary = await stream.whenDone();
        const sanitizedFinal = sanitizeAiChatMarkdown(accumulated);
        // 永続化: ai_chats に最終回答を保存 (sanitized)
        const aiChat = await prisma.aiChat.create({
          data: {
            tenantId,
            assessmentItemId: id,
            userId,
            question: parsed.data.question,
            answer: sanitizedFinal.text,
            promptVersion: summary.promptVersion,
            rating: null,
          },
          select: { id: true },
        });
        await writeAudit({
          tenantId,
          userId,
          action: 'ai_chat.create',
          resourceType: 'ai_chat',
          resourceId: aiChat.id,
          afterValue: {
            assessmentItemId: id.toString(),
            degraded: summary.degraded,
            sanitizationNotes: sanitizedFinal.notes,
            promptVersion: summary.promptVersion,
          },
        });
        controller.enqueue(
          encoder.encode(
            sseEvent('meta', {
              aiChatId: aiChat.id.toString(),
              promptVersion: summary.promptVersion,
              degraded: summary.degraded,
              sanitizationNotes: sanitizedFinal.notes,
            }),
          ),
        );
        controller.enqueue(encoder.encode(sseEvent('done', {})));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sseEvent('error', {
              message: err instanceof Error ? err.message : 'stream failure',
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
