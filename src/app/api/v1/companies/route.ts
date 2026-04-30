import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crawl, UrlBlockedError, UpstreamError } from '@/lib/crawler';
import { estimate } from '@/lib/llm';
import { urlSchema } from '@/lib/validation/url-schema';
import { problemResponse } from '@/lib/server/problem-details';
import { requireRoleFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { prisma } from '@/lib/server/db';

/**
 * POST /api/v1/companies
 * spec.md §3.3 / §4.1: URL 投入 → SSRF safe crawl → LLM estimation → upsert Company → 202.
 *
 * 認可: editor 以上 (spec.md §6 — viewer/reviewer は禁止)
 *
 * 実体は同期処理として実装 (Wave 2 簡易版)。
 * 将来的にクローラー/LLM を SQS 非同期化する場合は本ハンドラから enqueue に切替。
 */

export const runtime = 'nodejs';

const RequestSchema = urlSchema; // { url: string }

interface ResponseBody {
  id: string;
  domain: string;
  status: 'analyzing' | 'completed';
  pollUrl: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireRoleFromRequest(req, 'editor');
  if (!guard.ok) return guard.response;

  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  const { tenantId, userId } = await resolveTenantContext(guard.user);

  // 1) SSRF safe crawl
  let crawlResult;
  try {
    crawlResult = await crawl(parsed.data.url);
  } catch (e) {
    if (e instanceof UrlBlockedError) {
      await writeAudit({
        tenantId,
        userId,
        action: 'ssrf.block',
        resourceType: 'company',
        resourceId: null,
        afterValue: { url: parsed.data.url, reason: e.reason },
      });
      return problemResponse('url_blocked', {
        detail: e.message,
        extras: { reason: e.reason },
      });
    }
    if (e instanceof UpstreamError) {
      return problemResponse('upstream_error', { detail: e.message });
    }
    throw e;
  }

  // 2) LLM estimation (failure → rule-based fallback inside)
  const est = await estimate({
    url: parsed.data.url,
    title: crawlResult.extraction.title,
    description: crawlResult.extraction.description,
    publicText: crawlResult.extraction.textSnippet,
  });

  // 3) Upsert Company (per (tenant, domain) — spec.md §2)
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
      url: parsed.data.url,
      degraded: est.degraded,
      provider: est.provider,
      confidence: est.output.confidence,
    },
  });

  const id = company.id.toString();
  const body: ResponseBody = {
    id,
    domain: company.domain,
    status: 'completed',
    pollUrl: `/api/v1/companies/${id}`,
  };
  return NextResponse.json(body, { status: 202 });
}
