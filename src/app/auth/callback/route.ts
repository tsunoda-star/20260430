import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, loadCcAuthConfig } from '@/lib/auth/cc-auth';
import {
  SESSION_COOKIE_NAME,
  buildSessionCookieAttributes,
  verifyIdToken,
} from '@/lib/auth/session';
import { PKCE_VERIFIER_COOKIE, STATE_COOKIE } from '../login/page';

export const dynamic = 'force-dynamic';

/**
 * GET /auth/callback?code=...&state=...
 * - state を Cookie と照合 (CSRF 対策)
 * - code を token に交換 (PKCE)
 * - id_token を検証して session cookie に保存
 * - 既定の redirect 先 (env: NEXT_PUBLIC_CC_AUTH_POST_LOGIN_REDIRECT) へ 302
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return problemResponse(400, 'auth_provider_error', `Cognito error: ${errorParam}`);
  }
  if (!code || !state) {
    return problemResponse(400, 'invalid_callback', 'code and state are required');
  }

  const cookieStore = cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const verifier = cookieStore.get(PKCE_VERIFIER_COOKIE)?.value;

  if (!expectedState || expectedState !== state) {
    return problemResponse(400, 'state_mismatch', 'OAuth state mismatch (possible CSRF)');
  }
  if (!verifier) {
    return problemResponse(400, 'pkce_missing', 'PKCE code_verifier missing');
  }

  const config = loadCcAuthConfig();
  const tokens = await exchangeCodeForTokens(config, { code, codeVerifier: verifier });
  // セキュリティ検証: id_token を JWKS で署名検証 + claim 整合
  await verifyIdToken(tokens.id_token);

  // PKCE / state cookie は使用済みなので破棄
  cookieStore.delete(PKCE_VERIFIER_COOKIE);
  cookieStore.delete(STATE_COOKIE);

  // セッションには id_token のみ格納 (refresh は今回スコープ外、Wave 2+で拡張)
  const cookieAttrs = buildSessionCookieAttributes({ maxAgeSec: tokens.expires_in });
  cookieStore.set(SESSION_COOKIE_NAME, tokens.id_token, cookieAttrs);

  const postLogin =
    process.env.NEXT_PUBLIC_CC_AUTH_POST_LOGIN_REDIRECT ?? new URL('/', request.url).toString();
  return NextResponse.redirect(postLogin, 302);
}

function problemResponse(status: number, type: string, detail: string): Response {
  // RFC7807 Problem Details (spec.md §3.1)
  return new Response(
    JSON.stringify({
      type: `urn:problem:cc-auth:${type}`,
      title: 'CC-Auth callback error',
      status,
      detail,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
    },
  );
}
