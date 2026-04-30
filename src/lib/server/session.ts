import type { NextRequest } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SessionVerifyError,
  ROLE_HIERARCHY,
  hasRole,
  verifyIdToken,
  type SessionUser,
  type UserRole,
} from '@/lib/auth/session';
import { isDevAuthBypassEnabled, devSessionUser } from '@/lib/auth/dev-bypass';
import { problemResponse } from './problem-details';
import { canPerform, whyNotAllowedJa, type PermissionAction } from './permissions';

/**
 * Route Handler 用セッション解決ヘルパー。
 *
 * - middleware.ts でも cookie 検証はしているが、API ハンドラ内で
 *   再検証することで信頼境界をハンドラ層に置く (defense-in-depth)。
 * - role の不足は 403 forbidden を返す (spec.md §3.5 / §6)。
 */

export type RoleGuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: ReturnType<typeof problemResponse> };

export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  // Dev only: NODE_ENV=development + DEV_AUTH_BYPASS=1 で固定 SessionUser を返す
  if (isDevAuthBypassEnabled()) {
    return devSessionUser();
  }
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifyIdToken(token);
  } catch (err) {
    if (err instanceof SessionVerifyError) return null;
    throw err;
  }
}

export async function requireRoleFromRequest(
  req: NextRequest,
  min: UserRole,
): Promise<RoleGuardResult> {
  const user = await getSessionFromRequest(req);
  if (!user) {
    return { ok: false, response: problemResponse('unauthorized') };
  }
  if (!hasRole(user.role, min)) {
    return {
      ok: false,
      response: problemResponse('forbidden', {
        detail: `requires role >= ${min}, current=${user.role}`,
      }),
    };
  }
  return { ok: true, user };
}

/**
 * 操作 (PermissionAction) ベースの認可ガード。
 * spec.md §6 に従い、ハードコードされたロールリストではなく
 * `canPerform(user.role, action)` で判定する。
 */
export async function requireActionFromRequest(
  req: NextRequest,
  action: PermissionAction,
): Promise<RoleGuardResult> {
  const user = await getSessionFromRequest(req);
  if (!user) {
    return { ok: false, response: problemResponse('unauthorized') };
  }
  if (!canPerform(user.role, action)) {
    return {
      ok: false,
      response: problemResponse('forbidden', {
        detail: whyNotAllowedJa(user.role, action) ?? 'forbidden',
        extras: { action, role: user.role },
      }),
    };
  }
  return { ok: true, user };
}

export { ROLE_HIERARCHY, hasRole };
export type { SessionUser, UserRole };
