import type { UserRole } from '@/lib/auth/session';

/**
 * spec.md §6.2 操作×ロール マトリクス (SSOT).
 * このファイルが権限ポリシーの唯一の真実源。サーバー (requireAction)
 * とクライアント (useRole hook) の両方が本マトリクスを参照する。
 */

export type PermissionAction =
  | 'company.create' // URL入力・分析開始
  | 'company.update' // 企業プロフィール編集
  | 'assessment.create' // 評価シート新規作成
  | 'assessment.delete' // 評価シート削除
  | 'assessment.read' // 評価シート閲覧
  | 'assessment_item.update_status' // ステータス変更
  | 'assessment_item.update_note' // メモ・証跡登録 (reviewer は note 追記のみ)
  | 'assessment_item.assign' // 担当・期限割当
  | 'ai_chat.ask' // AIチャット質問
  | 'ai_chat.rate' // Good/Bad 評価
  | 'admin.invite_user' // ユーザー招待・ロール変更
  | 'export.run' // Excel/PDF/CSV
  | 'master.update' // マスタ更新
  | 'audit_log.read'; // 監査ログ参照

const ALL_ROLES: UserRole[] = ['owner', 'admin', 'editor', 'reviewer', 'viewer'];

/**
 * 各操作に対する許可ロール集合 (spec.md §6.2 表の縦列を集約)。
 * 注: reviewer の "note追記のみ" は assessment_item.update_note 配下に
 *     reviewer を含めるが、PATCH 側で note フィールド以外は別途拒否する責務がある。
 */
export const PERMISSION_MATRIX: Readonly<Record<PermissionAction, ReadonlyArray<UserRole>>> = {
  'company.create': ['owner', 'admin', 'editor'],
  'company.update': ['owner', 'admin'],
  'assessment.create': ['owner', 'admin', 'editor'],
  'assessment.delete': ['owner', 'admin'],
  'assessment.read': ALL_ROLES,
  'assessment_item.update_status': ['owner', 'admin', 'editor'],
  'assessment_item.update_note': ['owner', 'admin', 'editor', 'reviewer'],
  'assessment_item.assign': ['owner', 'admin', 'editor'],
  'ai_chat.ask': ['owner', 'admin', 'editor', 'reviewer'],
  'ai_chat.rate': ['owner', 'admin', 'editor', 'reviewer'],
  'admin.invite_user': ['owner', 'admin'],
  'export.run': ALL_ROLES,
  'master.update': ['owner', 'admin'],
  'audit_log.read': ['owner', 'admin'],
};

/** UI 表示用の操作ラベル (日本語) */
export const ACTION_LABELS_JA: Record<PermissionAction, string> = {
  'company.create': 'URL入力・分析開始',
  'company.update': '企業プロフィール編集',
  'assessment.create': '評価シート新規作成',
  'assessment.delete': '評価シート削除',
  'assessment.read': '評価シート閲覧',
  'assessment_item.update_status': 'ステータス変更',
  'assessment_item.update_note': 'メモ・証跡登録',
  'assessment_item.assign': '担当・期限割当',
  'ai_chat.ask': 'AIチャット利用',
  'ai_chat.rate': 'Good/Bad評価',
  'admin.invite_user': 'ユーザー招待・ロール変更',
  'export.run': 'エクスポート',
  'master.update': 'マスタ更新',
  'audit_log.read': '監査ログ参照',
};

/** ロールが操作を実行できるか */
export function canPerform(role: UserRole, action: PermissionAction): boolean {
  return PERMISSION_MATRIX[action].includes(role);
}

/** UI 表示用: なぜ disabled なのかの理由 (spec.md §9.6 認可エラー文言) */
export function whyNotAllowedJa(role: UserRole, action: PermissionAction): string | null {
  if (canPerform(role, action)) return null;
  const allowed = PERMISSION_MATRIX[action];
  const label = ACTION_LABELS_JA[action];
  if (allowed.length === 0) return `${label} は現在無効化されています`;
  return `${label} には ${allowed.join('/')} 権限が必要です (現在: ${role})`;
}
