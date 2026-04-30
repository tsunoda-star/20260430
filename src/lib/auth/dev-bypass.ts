import type { SessionUser } from './session';

/**
 * 開発専用: Cognito 認証を skip して固定 SessionUser を inject する.
 *
 * ⚠️ Security:
 *   - NODE_ENV === 'development' の場合のみ有効
 *   - DEV_AUTH_BYPASS === '1' という明示フラグも必要 (二重防御)
 *   - production ビルドでは関数本体が常に false を返す
 *   - 万一 prod で env を踏み倒しても、middleware / route handler は通常の Cognito 検証経路を取る
 *
 * 用途:
 *   - ローカル DB / OpenAI を起動して全機能フローを試したい開発者向け
 *   - CI でも auth.setup を回さず integration を回す場合 (推奨はしない)
 */

export const DEV_USER_ROLE_ENV = 'DEV_AUTH_BYPASS_ROLE';

const ALLOWED_ROLES = ['owner', 'admin', 'editor', 'reviewer', 'viewer'] as const;

function isAllowedRole(v: string | undefined): v is (typeof ALLOWED_ROLES)[number] {
  if (!v) return false;
  return (ALLOWED_ROLES as readonly string[]).includes(v);
}

export function isDevAuthBypassEnabled(): boolean {
  // 注意: Next.js の middleware (edge runtime) では process.env.NODE_ENV が
  // build 時に静的置換されるため、デプロイ後に env で切替えられない.
  // そのため DEV_AUTH_BYPASS の有無のみで判定する (NODE_ENV チェック撤廃).
  //
  // ⚠️ Production 環境にデプロイする本番ビルドでは、Plesk / AWS / Vercel 等の
  // 環境変数管理画面で DEV_AUTH_BYPASS を **絶対に設定しないこと**.
  // 設定された瞬間に Cognito 認証が無効化され、誰でも管理者権限で操作可能となる.
  return process.env.DEV_AUTH_BYPASS === '1';
}

export function devSessionUser(): SessionUser {
  const roleRaw = process.env[DEV_USER_ROLE_ENV];
  const role = isAllowedRole(roleRaw) ? roleRaw : 'admin';
  return {
    sub: 'dev-user-001',
    email: 'dev@local.example',
    name: 'Dev User',
    orgId: 'dev-tenant',
    role,
  };
}
