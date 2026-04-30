import { randomBytes } from 'node:crypto';

/**
 * spec.md §3.2 + Cycle 4.4: ユーザー招待トークン生成.
 *
 * - 32 byte 乱数 → hex 64 文字
 * - 24h TTL — Phase 6 で email 送信 + 専用テーブル化を予定
 *   (現状はトークンを Admin に返却して手動共有する MVP 実装)
 */

export const INVITATION_TOKEN_BYTES = 32;
export const INVITATION_TTL_HOURS = 24;

export interface InvitationToken {
  token: string;
  expiresAt: string; // ISO
  url: (origin: string) => string;
}

export function generateInvitationToken(): InvitationToken {
  const token = randomBytes(INVITATION_TOKEN_BYTES).toString('hex');
  const expires = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);
  return {
    token,
    expiresAt: expires.toISOString(),
    url: (origin) => `${origin.replace(/\/+$/, '')}/auth/invite?token=${token}`,
  };
}
