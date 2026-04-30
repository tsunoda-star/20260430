/**
 * Session helpers — JWT verification + role parsing.
 *
 * - Cognito ID token を `jose` で remote JWKS 検証する。
 * - Role は spec.md §2 に従い owner / admin / editor / reviewer / viewer の 5 段階。
 * - クッキーは httpOnly + Secure + SameSite=Lax 推奨。
 * - 本ファイルは Edge runtime (middleware) 互換にするため Node 固有 API を使わない。
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { loadCcAuthConfig } from './cc-auth';

export type UserRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  reviewer: 1,
  viewer: 0,
};

export interface SessionUser {
  sub: string;
  email: string;
  name?: string;
  orgId: string;
  role: UserRole;
}

export class SessionVerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionVerifyError';
  }
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksKey = '';

function getJwks() {
  const cfg = loadCcAuthConfig();
  const key = `${cfg.region}|${cfg.userPoolId}`;
  if (cachedJwks && cachedJwksKey === key) return { jwks: cachedJwks, cfg };
  const issuer = `https://cognito-idp.${cfg.region}.amazonaws.com/${cfg.userPoolId}`;
  cachedJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  cachedJwksKey = key;
  return { jwks: cachedJwks, cfg };
}

/**
 * Cognito ID Token を検証して SessionUser を返す。
 * - issuer / audience を照合
 * - 署名検証 (remote JWKS)
 * - role が未知の場合は viewer に丸める (fail-safe defaults)
 */
export async function verifyIdToken(idToken: string): Promise<SessionUser> {
  if (!idToken) throw new SessionVerifyError('id_token is empty');

  const { jwks, cfg } = getJwks();
  const issuer = `https://cognito-idp.${cfg.region}.amazonaws.com/${cfg.userPoolId}`;

  let payload: JWTPayload;
  try {
    const { payload: p } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: cfg.clientId,
    });
    payload = p;
  } catch (err) {
    throw new SessionVerifyError(
      `id_token verification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const sub = String(payload.sub ?? '');
  const email = String(payload['email'] ?? '');
  const name = typeof payload['name'] === 'string' ? (payload['name'] as string) : undefined;

  // CC-Auth は org_id クレームを発行する (spec.md §3.1)
  const orgIdRaw = payload['org_id'] ?? payload['custom:org_id'] ?? payload['cognito:groups'];
  const orgId = Array.isArray(orgIdRaw) ? String(orgIdRaw[0] ?? '') : String(orgIdRaw ?? '');

  const roleRaw = String(payload['custom:role'] ?? payload['role'] ?? 'viewer').toLowerCase();
  const role: UserRole = isRole(roleRaw) ? roleRaw : 'viewer';

  if (!sub || !email || !orgId) {
    throw new SessionVerifyError(
      'id_token missing required claims (sub / email / org_id)',
    );
  }

  return { sub, email, name, orgId, role };
}

export function isRole(value: string): value is UserRole {
  return value in ROLE_HIERARCHY;
}

/** role at least `min` か (例: hasRole(user.role, 'editor')) */
export function hasRole(role: UserRole, min: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[min];
}

/* ---------- cookie helpers ---------- */
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'sct_session';

export interface SessionCookieOptions {
  maxAgeSec: number;
}

export function buildSessionCookieAttributes(opts: SessionCookieOptions): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: opts.maxAgeSec,
  };
}
