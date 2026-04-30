import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { generateInvitationToken } from '@/lib/server/invitation';

/**
 * POST /api/v1/admin/users/invite
 * spec.md §3.2 + Cycle 4.4: 新ユーザー招待.
 * 認可: admin.invite_user (owner / admin)
 *
 * Wave 4 MVP: トークンを生成して Admin に返却 + AuditLog 記録のみ。
 * メール送信や招待テーブル永続化は Phase 6 で拡張予定。
 */

export const runtime = 'nodejs';

const RoleEnum = z.enum(['owner', 'admin', 'editor', 'reviewer', 'viewer']);

const RequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  role: RoleEnum,
  /** 任意のメッセージ (招待メール本文用 / 監査ログに保存) */
  message: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'admin.invite_user');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  // owner ロールの招待は owner ロール本人しか発行できない (権限昇格を防止)
  if (parsed.data.role === 'owner' && guard.user.role !== 'owner') {
    return problemResponse('forbidden', {
      detail: 'owner ロールの招待は owner のみ可能です',
      extras: { currentRole: guard.user.role },
    });
  }

  const { tenantId, userId } = await resolveTenantContext(guard.user);
  const inv = generateInvitationToken();
  const origin = req.nextUrl.origin;

  await writeAudit({
    tenantId,
    userId,
    action: 'admin.invite_user',
    resourceType: 'user',
    resourceId: null,
    afterValue: {
      email: parsed.data.email,
      role: parsed.data.role,
      tokenPrefix: inv.token.slice(0, 8),
      expiresAt: inv.expiresAt,
      message: parsed.data.message ?? null,
    },
  });

  return NextResponse.json(
    {
      email: parsed.data.email,
      role: parsed.data.role,
      token: inv.token,
      inviteUrl: inv.url(origin),
      expiresAt: inv.expiresAt,
    },
    { status: 201 },
  );
}
