import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifyIdToken } from '@/lib/auth/session';
import { isDevAuthBypassEnabled } from '@/lib/auth/dev-bypass';

/**
 * Middleware — protected routes でセッション検証。
 * - /auth/*, /api/v1/auth/*, ランディング (/), アセットは除外。
 * - それ以外は session cookie が有効 (JWKS 検証 PASS) なら通す。
 * - Wave 2 で /app/* 以下を本格的に保護する。今回はベース実装のみ。
 */
const PROTECTED_PREFIXES = ['/app', '/api/v1'] as const;
const ALWAYS_OPEN = [
  '/api/v1/auth/session', // login bootstrap (Wave 2)
  '/api/v1/health',
  '/api/v1/me/anonymous', // future health check stub
];

export async function middleware(request: NextRequest): Promise<NextResponse | undefined> {
  const { pathname } = request.nextUrl;

  if (!PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return undefined;
  }
  if (ALWAYS_OPEN.includes(pathname)) {
    return undefined;
  }

  // Dev only: NODE_ENV=development + DEV_AUTH_BYPASS=1 で middleware を skip.
  // production ビルドでは isDevAuthBypassEnabled() が常に false。
  if (isDevAuthBypassEnabled()) {
    return undefined;
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return redirectToLogin(request);

  try {
    await verifyIdToken(token);
    return undefined;
  } catch {
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith('/api')) {
    return new NextResponse(
      JSON.stringify({
        type: 'urn:problem:cc-auth:unauthenticated',
        title: 'Authentication required',
        status: 401,
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
      },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = '/auth/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/app/:path*', '/api/v1/:path*'],
};
