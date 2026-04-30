/**
 * CC-Auth (Cognito) PKCE OAuth helpers.
 *
 * Phase 4 / Wave 1: PKCE 開始 + コールバック交換 + ID/Access トークン取得まで。
 *   - userPoolId / clientId は process.env から取得 (ハードコード禁止 — Phase 5.5 mock-detector 対象)
 *   - 本番では SSM Parameter Store から動的取得し env として注入する想定
 *     (.ccagi.yml `cc_auth.ssm_paths.*` 参照)
 *
 * NOT CHANGE here: トークン validation は session.ts に分離。
 */

const TEXT_ENCODER = new TextEncoder();

export interface CcAuthConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  domain: string; // Cognito Hosted UI domain
  redirectUri: string;
  scopes: readonly string[];
}

export class CcAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CcAuthConfigError';
  }
}

/**
 * 環境変数から CC-Auth 設定を読み出す。process.env のみを使い、ファイル内に値を書かない。
 * 不足は明示的にエラーにする (silent fallback 禁止)。
 */
export function loadCcAuthConfig(): CcAuthConfig {
  const region = process.env.COGNITO_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const domain = process.env.COGNITO_DOMAIN;
  const redirectUri = process.env.NEXT_PUBLIC_CC_AUTH_REDIRECT_URI;

  const missing: string[] = [];
  if (!region) missing.push('COGNITO_REGION');
  if (!userPoolId) missing.push('COGNITO_USER_POOL_ID');
  if (!clientId) missing.push('COGNITO_CLIENT_ID');
  if (!domain) missing.push('COGNITO_DOMAIN');
  if (!redirectUri) missing.push('NEXT_PUBLIC_CC_AUTH_REDIRECT_URI');
  if (missing.length > 0) {
    throw new CcAuthConfigError(
      `CC-Auth 環境変数が不足しています: ${missing.join(', ')}. .env.example を参考に .env.local を作成してください。`,
    );
  }

  return {
    region: region!,
    userPoolId: userPoolId!,
    clientId: clientId!,
    domain: domain!,
    redirectUri: redirectUri!,
    scopes: ['openid', 'profile', 'email'],
  };
}

/**
 * PKCE: code_verifier (43-128 文字) を生成して、code_challenge (S256) を返す。
 * 暗号学的乱数のみ使用 (Math.random 不可)。
 */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random);
  const digest = await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

/** 暗号学的に安全な opaque state token (CSRF 対策) */
export function createState(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

/** PKCE 開始 URL (Cognito Hosted UI) を組み立てる */
export function buildAuthorizeUrl(
  config: CcAuthConfig,
  params: { state: string; codeChallenge: string },
): string {
  const url = new URL(`https://${config.domain}/oauth2/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', params.codeChallenge);
  return url.toString();
}

export interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  token_type: 'Bearer';
  expires_in: number;
}

/**
 * authorization_code → tokens (PKCE 検証付き)
 * 失敗時は throw、呼び出し側で 4xx に変換する。
 */
export async function exchangeCodeForTokens(
  config: CcAuthConfig,
  args: { code: string; codeVerifier: string },
): Promise<TokenResponse> {
  const tokenUrl = `https://${config.domain}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: args.code,
    redirect_uri: config.redirectUri,
    code_verifier: args.codeVerifier,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `CC-Auth token exchange failed: HTTP ${String(res.status)} ${text.slice(0, 200)}`,
    );
  }

  return (await res.json()) as TokenResponse;
}

/** Cognito Hosted UI のログアウト URL (CC-Auth.localhost_redirect 等を redirect 先に) */
export function buildLogoutUrl(config: CcAuthConfig, postLogoutRedirect: string): string {
  const url = new URL(`https://${config.domain}/logout`);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('logout_uri', postLogoutRedirect);
  return url.toString();
}

/* ---------------------------------------------------------------- */
/* utilities                                                         */
/* ---------------------------------------------------------------- */

function base64UrlEncode(buf: Uint8Array): string {
  let str = '';
  for (let i = 0; i < buf.length; i++) {
    str += String.fromCharCode(buf[i]!);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
