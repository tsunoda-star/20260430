import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { prisma } from '@/lib/server/db';
import { aggregateDashboard, type DashboardItemRow } from '@/lib/server/dashboard';

/**
 * GET /api/v1/assessments/:id/dashboard
 * spec.md §4 + Cycle 4.3: 進捗ドーナツ / 期限超過 / カテゴリ別ヒートマップ用の集計.
 *
 * 認可: assessment.read (全ロール)
 * tenantId 強制スコープ
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

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'assessment.read');
  if (!guard.ok) return guard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const { tenantId } = await resolveTenantContext(guard.user);

  // tenant スコープで assessment が存在することを確認 (heat map 用 items は join で取得)
  const assessment = await prisma.assessment.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      items: {
        select: {
          status: true,
          dueDate: true,
          controlItem: { select: { category: true } },
        },
      },
    },
  });
  if (!assessment) return problemResponse('not_found');

  const rows: DashboardItemRow[] = assessment.items.map((it) => ({
    status: it.status,
    dueDate: it.dueDate ? it.dueDate.toISOString().slice(0, 10) : null,
    category: it.controlItem.category,
  }));
  const summary = aggregateDashboard(rows);

  return NextResponse.json({
    assessmentId: assessment.id.toString(),
    title: assessment.title,
    status: assessment.status,
    ...summary,
  });
}
