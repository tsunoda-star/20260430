export const dynamic = 'force-dynamic';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problemResponse } from '@/lib/server/problem-details';
import { getSessionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { prisma } from '@/lib/server/db';

/**
 * GET /api/v1/me/reviewer-assignments
 * spec.md §4.3 / Cycle 3.5: Reviewer に割り当てられた status=done の項目一覧.
 *
 * - Reviewer / Editor / Admin / Owner が呼ぶことを想定 (Reviewer は確認待ち、
 *   他ロールは「自分が担当する確認待ち」を確認する用途)
 * - 認可: 認証済みのみ (権限階層フィルタは不要 — ユーザーごとの ASIN なので)
 * - tenantId 強制 + assigneeId=自分 + status='done' の AssessmentItem を返す
 *
 * 返却フィールドは UI 通知バナー用に最小限。
 */

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getSessionFromRequest(req);
  if (!user) return problemResponse('unauthorized');

  const { tenantId, userId } = await resolveTenantContext(user);

  const items = await prisma.assessmentItem.findMany({
    where: { tenantId, assigneeId: userId, status: 'done' },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      assessmentId: true,
      updatedAt: true,
      controlItem: {
        select: {
          title: true,
          category: true,
          guidelineVersion: {
            select: {
              version: true,
              guideline: { select: { name: true } },
            },
          },
        },
      },
      assessment: { select: { title: true } },
    },
  });

  return NextResponse.json({
    role: user.role,
    items: items.map((it) => ({
      id: it.id.toString(),
      assessmentId: it.assessmentId.toString(),
      assessmentTitle: it.assessment.title,
      controlTitle: it.controlItem.title,
      category: it.controlItem.category,
      guidelineName: it.controlItem.guidelineVersion.guideline.name,
      guidelineVersion: it.controlItem.guidelineVersion.version,
      updatedAt: it.updatedAt.toISOString(),
    })),
  });
}
