import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problemResponse } from '@/lib/server/problem-details';
import { requireRoleFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { prisma } from '@/lib/server/db';

/**
 * GET /api/v1/companies/:id — プロフィール取得 (推定根拠含む).
 * spec.md §3.2: 全ロール read 可 (viewer も含む)。
 *
 * tenantId スコープを必ず付与し、テナント越え参照を防止する (404 で隠蔽)。
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
  const guard = await requireRoleFromRequest(req, 'viewer');
  if (!guard.ok) return guard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const { tenantId } = await resolveTenantContext(guard.user);

  const company = await prisma.company.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      domain: true,
      displayName: true,
      industry: true,
      size: true,
      inferredData: true,
      inferenceConfidence: true,
      userOverrides: true,
      createdAt: true,
    },
  });
  if (!company) return problemResponse('not_found');

  return NextResponse.json({
    id: company.id.toString(),
    domain: company.domain,
    displayName: company.displayName,
    industry: company.industry,
    size: company.size,
    inferredData: company.inferredData,
    inferenceConfidence: company.inferenceConfidence,
    userOverrides: company.userOverrides,
    createdAt: company.createdAt.toISOString(),
  });
}
