import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problemResponse } from '@/lib/server/problem-details';
import { getSessionFromRequest } from '@/lib/server/session';
import { prisma } from '@/lib/server/db';

/**
 * GET /api/v1/master/latest-version
 * Cycle 4.4 マスタ更新通知バナー用エンドポイント.
 *
 * 認証済みのみ呼べる (Tenant 越え情報ではないため tenant スコープ不要).
 * 戻り値: { latestReleasedAt, count } — クライアントは前回 dismissed 時刻と比較する。
 */

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getSessionFromRequest(req);
  if (!user) return problemResponse('unauthorized');

  const latest = await prisma.guidelineVersion.findFirst({
    where: { guideline: { isActive: true } },
    orderBy: { releasedAt: 'desc' },
    select: { releasedAt: true, version: true },
  });
  const count = await prisma.guidelineVersion.count({
    where: { guideline: { isActive: true } },
  });

  return NextResponse.json({
    latestReleasedAt: latest?.releasedAt.toISOString() ?? null,
    latestVersion: latest?.version ?? null,
    activeGuidelineVersions: count,
  });
}
