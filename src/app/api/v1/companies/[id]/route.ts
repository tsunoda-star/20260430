import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { problemResponse } from '@/lib/server/problem-details';
import { requireRoleFromRequest, requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
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

/**
 * PATCH /api/v1/companies/:id
 * 推定業種/規模/会社名のユーザー修正。
 * - editor 以上が呼べる (company.update)
 * - 修正は industry/size 直接更新 + userOverrides JSON に履歴を残す
 */
const PatchSchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  industry: z.string().trim().min(1).max(64).optional(),
  size: z.enum(['startup', 'sme', 'mid', 'enterprise', 'unknown']).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'company.update');
  if (!guard.ok) return guard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  const { tenantId, userId } = await resolveTenantContext(guard.user);

  const existing = await prisma.company.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      displayName: true,
      industry: true,
      size: true,
      userOverrides: true,
    },
  });
  if (!existing) return problemResponse('not_found');

  const overrides = (existing.userOverrides ?? {}) as Record<string, unknown>;
  if (parsed.data.industry !== undefined) overrides.industry = parsed.data.industry;
  if (parsed.data.size !== undefined) overrides.size = parsed.data.size;
  if (parsed.data.displayName !== undefined) overrides.displayName = parsed.data.displayName;
  overrides.confirmedAt = new Date().toISOString();
  overrides.confirmedById = userId.toString();

  const updated = await prisma.company.update({
    where: { id },
    data: {
      ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
      ...(parsed.data.industry !== undefined ? { industry: parsed.data.industry } : {}),
      ...(parsed.data.size !== undefined ? { size: parsed.data.size } : {}),
      userOverrides: overrides as unknown as object,
    },
    select: {
      id: true,
      displayName: true,
      industry: true,
      size: true,
      userOverrides: true,
    },
  });

  await writeAudit({
    tenantId,
    userId,
    action: 'company.update',
    resourceType: 'company',
    resourceId: id,
    beforeValue: {
      displayName: existing.displayName,
      industry: existing.industry,
      size: existing.size,
    },
    afterValue: {
      displayName: updated.displayName,
      industry: updated.industry,
      size: updated.size,
    },
  });

  return NextResponse.json({
    id: updated.id.toString(),
    displayName: updated.displayName,
    industry: updated.industry,
    size: updated.size,
    userOverrides: updated.userOverrides,
  });
}
