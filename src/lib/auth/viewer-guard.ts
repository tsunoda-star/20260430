import type { UserRole } from './session';

/**
 * spec.md §5.3 / Cycle 3.3: Viewer エクスポート専用フロー.
 *
 * クライアント側で Viewer がアクセスすべきでない画面を判定し、
 * 専用ホーム / エクスポート画面へリダイレクトする。
 * ※ 信頼境界はサーバー側 (requireActionFromRequest) — これは UX 補助のみ。
 */

/**
 * Viewer は本パスへのアクセスを禁止する (S2 / S4 / S7 / S8)。
 * 完全一致 / 接頭辞いずれかでマッチする。
 */
const VIEWER_FORBIDDEN_PREFIXES: ReadonlyArray<string> = [
  '/app/companies', // S2 分析結果・属性確認
  '/app/items/edit', // S4 項目編集 (注: read-only S4 は別ルート)
  '/app/admin/users', // S7 ユーザー管理
  '/app/admin/master', // S8 マスタ管理
];

/** ランディング・特殊パスの完全一致リスト */
const VIEWER_ALLOWED_EXACT: ReadonlySet<string> = new Set(['/']);

/** Viewer 遷移可能な接頭辞 (path === prefix or path.startsWith(prefix + '/')) */
const VIEWER_ALLOWED_PREFIXES: ReadonlyArray<string> = [
  '/auth', // OIDC ログイン関連
  '/api', // サーバー側で別途認可 (本判定の対象外)
  '/app/viewer', // Viewer 専用ホーム + S3 read-only + S5 export
];

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Viewer ロールでこのパスにアクセスして良いか */
export function isViewerAllowedPath(path: string): boolean {
  if (VIEWER_FORBIDDEN_PREFIXES.some((deny) => matchesPrefix(path, deny))) return false;
  if (VIEWER_ALLOWED_EXACT.has(path)) return true;
  return VIEWER_ALLOWED_PREFIXES.some((allow) => matchesPrefix(path, allow));
}

/** ロール × パスで Viewer 制限を発動するか (= リダイレクトすべきか) */
export function shouldRedirectViewer(role: UserRole | null, path: string): boolean {
  if (role !== 'viewer') return false;
  return !isViewerAllowedPath(path);
}

/** Viewer の代替遷移先 (Viewer 専用ホーム) */
export const VIEWER_HOME_PATH = '/app/viewer';
