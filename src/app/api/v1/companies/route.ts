import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crawl, UrlBlockedError, UpstreamError } from '@/lib/crawler';
import { estimate } from '@/lib/llm';
import { urlSchema } from '@/lib/validation/url-schema';
import { problemResponse } from '@/lib/server/problem-details';
import { requireRoleFromRequest, requireActionFromRequest } from '@/lib/server/session';
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

/**
 * GET /api/v1/companies?recent=10
 * spec.md §3.2 + Cycle 7.3b: 履歴 (最近の Company) 一覧.
 *
 * 認可: assessment.read (全ロール / Viewer 含む)
 * tenantId 強制スコープ
 * Query: recent=1..50 (default 10)
 */
const RecentQuerySchema = z.object({
  recent: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: NextRequest): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'assessment.read');
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = RecentQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  const { tenantId } = await resolveTenantContext(guard.user);

  const rows = await prisma.company.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: parsed.data.recent,
    select: {
      id: true,
      domain: true,
      displayName: true,
      industry: true,
      size: true,
      inferenceConfidence: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id.toString(),
      domain: r.domain,
      displayName: r.displayName,
      industry: r.industry,
      size: r.size,
      inferenceConfidence: r.inferenceConfidence,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
