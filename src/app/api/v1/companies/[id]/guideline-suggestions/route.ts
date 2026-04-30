import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Industry } from '@/lib/llm';
import { problemResponse } from '@/lib/server/problem-details';
import { requireRoleFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { prisma } from '@/lib/server/db';
import {
  buildSuggestions,
  type GuidelineLite,
  type SuggestionEntry,
} from '@/lib/server/suggestions';

/**
 * GET /api/v1/companies/:id/guideline-suggestions
 * spec.md §3.2 / §4.1: 推定 industry に基づく candidate + baseline グループを返す。
 *
 * Cycle 2.4 (本コミット): baseline + applies_to (domainTags 流用) マッチング。
 * Cycle 2.5: LLM-rank で並び替え + rationale を再生成して上書き。
 */

export const runtime = 'nodejs';

function parseId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

interface SerializedEntry extends Omit<SuggestionEntry, 'guideline'> {
  guideline: Omit<SuggestionEntry['guideline'], 'id'> & { id: string };
}

interface ResponseBody {
  baseline: SerializedEntry[];
  industryMatch: SerializedEntry[];
  inferredIndustry: Industry;
}

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  const guard = await requireRoleFromRequest(req, 'viewer');
  if (!guard.ok) return guard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const { tenantId } = await resolveTenantContext(guard.user);

  const company = await prisma.company.findFirst({
    where: { id, tenantId },
    select: { industry: true, inferredData: true },
  });
  if (!company) return problemResponse('not_found');

  const inferredIndustry = (company.industry ?? 'unknown') as Industry;

  // 全アクティブガイドライン (Cycle 2.5 で paginate 検討)
  const rows = await prisma.guideline.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      domainTags: true,
      isBaseline: true,
    },
    orderBy: [{ isBaseline: 'desc' }, { code: 'asc' }],
  });

  const guidelines: GuidelineLite[] = rows.map((g) => ({
    id: g.id,
    code: g.code,
    name: g.name,
    category: g.category,
    domainTags: g.domainTags,
    isBaseline: g.isBaseline,
    appliesTo: g.domainTags,
  }));

  const groups = buildSuggestions({
    guidelines,
    estimation: { industry: inferredIndustry },
  });

  // BigInt は JSON.stringify で投げるため文字列化する
  const serialize = (entries: SuggestionEntry[]): SerializedEntry[] =>
    entries.map((e) => ({
      ...e,
      guideline: { ...e.guideline, id: e.guideline.id.toString() },
    }));

  const body: ResponseBody = {
    baseline: serialize(groups.baseline),
    industryMatch: serialize(groups.industryMatch),
    inferredIndustry,
  };
  return NextResponse.json(body);
}
