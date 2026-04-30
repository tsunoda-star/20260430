import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';

/**
 * GET /api/v1/health
 * Cycle 7.4: ALB / monitoring 用のヘルスチェック.
 *
 * - 認証不要 (middleware の ALWAYS_OPEN リストに既に含まれる想定)
 * - DB に SELECT 1 を打って接続を確認
 * - LLM (OpenAI) は env が設定されているかのみ確認 (実 ping は cost が高いため省略)
 * - 200 OK / 503 Service Unavailable で返却
 */

export const runtime = 'nodejs';

interface HealthCheck {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  detail?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  uptimeSec: number;
  checks: HealthCheck[];
  version: string;
}

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';
const STARTED_AT = Date.now();

async function checkDb(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: 'database', status: 'ok' };
  } catch (e) {
    return {
      name: 'database',
      status: 'down',
      detail: e instanceof Error ? e.message : 'unknown',
    };
  }
}

function checkLlm(): HealthCheck {
  const provider = (process.env.LLM_PRIMARY_PROVIDER ?? 'openai').toLowerCase();
  if (provider === 'fallback') {
    return { name: 'llm', status: 'degraded', detail: 'fallback only' };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { name: 'llm', status: 'degraded', detail: 'OPENAI_API_KEY not set' };
  }
  return { name: 'llm', status: 'ok', detail: `provider=${provider}` };
}

function checkSession(): HealthCheck {
  if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) {
    return {
      name: 'cognito',
      status: 'degraded',
      detail: 'Cognito env not configured',
    };
  }
  return { name: 'cognito', status: 'ok' };
}

function aggregate(checks: HealthCheck[]): 'ok' | 'degraded' | 'down' {
  if (checks.some((c) => c.status === 'down')) return 'down';
  if (checks.some((c) => c.status === 'degraded')) return 'degraded';
  return 'ok';
}

export async function GET(_req: NextRequest): Promise<Response> {
  const checks: HealthCheck[] = [];
  checks.push(await checkDb());
  checks.push(checkLlm());
  checks.push(checkSession());

  const overall = aggregate(checks);
  const body: HealthResponse = {
    status: overall,
    uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
    checks,
    version: APP_VERSION,
  };
  const httpStatus = overall === 'down' ? 503 : 200;
  return NextResponse.json(body, {
    status: httpStatus,
    headers: { 'cache-control': 'no-store' },
  });
}
