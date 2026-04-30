import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { prisma } from '@/lib/server/db';

/**
 * PATCH /api/v1/admin/users/:id
 * spec.md §3.2 + Cycle 4.4: ユーザーのロール変更 / アクティブ化切替.
 *
 * 認可: admin.invite_user (owner / admin)
 *
 * 安全装置:
 *   - owner ロールへの昇格は owner 本人のみ
 *   - 自分自身を viewer 以下に降格不可 (locked-out 防止)
 *   - 最後の owner を非 owner に降格不可 (テナント乗っ取り防止)
 */

export const runtime = 'nodejs';

const RoleEnum = z.enum(['owner', 'admin', 'editor', 'reviewer', 'viewer']);

const RequestSchema = z
  .object({
    role: RoleEnum.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });

function parseId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'admin.invite_user');
  if (!guard.ok) return guard.response;

  const targetId = parseId(ctx.params.id);
  if (targetId === null) return problemResponse('not_found');

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  const { tenantId, userId: callerId } = await resolveTenantContext(guard.user);

  const target = await prisma.user.findFirst({
    where: { id: targetId, tenantId },
    select: { id: true, email: true, role: true, isActive: true },
  });
  if (!target) return problemResponse('not_found');

  // owner ロールへの昇格は owner 本人しかできない
  if (parsed.data.role === 'owner' && guard.user.role !== 'owner') {
    return problemResponse('forbidden', {
      detail: 'owner ロールへの変更は owner のみ可能です',
      extras: { callerRole: guard.user.role },
    });
  }

  // 自分自身を viewer / reviewer に降格不可
  if (
    target.id === callerId &&
    parsed.data.role &&
    (parsed.data.role === 'viewer' || parsed.data.role === 'reviewer')
  ) {
    return problemResponse('forbidden', {
      detail: '自分自身を viewer / reviewer に降格することはできません',
    });
  }

  // 最後の owner を降格しないこと
  if (target.role === 'owner' && parsed.data.role && parsed.data.role !== 'owner') {
    const ownerCount = await prisma.user.count({
      where: { tenantId, role: 'owner', isActive: true },
    });
    if (ownerCount <= 1) {
      return problemResponse('conflict', {
        detail: '最後の owner ロールは降格できません',
        extras: { ownerCount },
      });
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      role: parsed.data.role ?? undefined,
      isActive: parsed.data.isActive ?? undefined,
    },
    select: { id: true, email: true, role: true, isActive: true },
  });

  await writeAudit({
    tenantId,
    userId: callerId,
    action: 'admin.user_update',
    resourceType: 'user',
    resourceId: updated.id,
    beforeValue: { role: target.role, isActive: target.isActive },
    afterValue: { role: updated.role, isActive: updated.isActive },
  });

  return NextResponse.json({
    id: updated.id.toString(),
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
  });
}
