import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  buildAuthorizeUrl,
  createPkcePair,
  createState,
  loadCcAuthConfig,
} from '@/lib/auth/cc-auth';

export const dynamic = 'force-dynamic';

const PKCE_VERIFIER_COOKIE = 'sct_pkce_verifier';
const STATE_COOKIE = 'sct_oauth_state';

/**
 * /auth/login — PKCE フロー開始。
 *  - code_verifier と state を httpOnly Cookie に保存
 *  - Cognito Hosted UI へ 302 リダイレクト
 *  - クライアント JS は使わない (Server Component + redirect)
 */
export default async function LoginPage() {
  const config = loadCcAuthConfig();
  const { verifier, challenge } = await createPkcePair();
  const state = createState();

  const cookieStore = cookies();
  const secure = process.env.NODE_ENV === 'production';
  cookieStore.set(PKCE_VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 600, // 10分
  });
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 600,
  });

  redirect(buildAuthorizeUrl(config, { state, codeChallenge: challenge }));
}

export { PKCE_VERIFIER_COOKIE, STATE_COOKIE };
