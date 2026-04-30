import type { UserRole } from '@/lib/auth/session';

/**
 * spec.md §6.2 / Cycle 3.5: Reviewer は status=done の項目に対して
 * note 追記 + Good/Bad のみ可能。それ以外は server 側で 403 forbidden.
 *
 * 本ファイルはルート判定に使う純粋関数のみを公開し、Prisma 依存を持たない
 * (単体テスト容易化のため)。
 */

export type ItemStatus = 'open' | 'in_progress' | 'done' | 'not_applicable';

export type ReviewerCheck =
  | { ok: true }
  | { ok: false; reason: 'reviewer-status-not-done' };

/**
 * Reviewer ロール時に AssessmentItem を編集できるかどうか。
 * 他ロールは無条件で ok (本関数の責務は reviewer 制約だけ)。
 */
export function checkReviewerCanEdit(role: UserRole, status: ItemStatus): ReviewerCheck {
  if (role !== 'reviewer') return { ok: true };
  if (status === 'done') return { ok: true };
  return { ok: false, reason: 'reviewer-status-not-done' };
}

/**
 * Reviewer 制約に違反したリクエストの 403 forbidden 用詳細メッセージ。
 */
export function reviewerForbiddenMessage(currentStatus: ItemStatus): string {
  return `reviewer は status=done の項目のみ note 追記可能です (currentStatus=${currentStatus})`;
}
