import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { assertTenantScoped, TENANT_SCOPED_MODELS } from './db-tenant-guard';

/**
 * Prisma client singleton.
 *
 * 接続経路の選択:
 *   1. USE_NEON_HTTPS=1 もしくは DATABASE_URL に neon.tech を含む production 環境
 *      → @neondatabase/serverless + @prisma/adapter-neon を使い HTTPS (443) で接続
 *      理由: 一部のホスティング (Pro-Web Plesk 等) は outbound TCP 5432 を制限
 *      しているため、443 経由のみで接続可能になる必要がある。
 *   2. それ以外 (ローカル / 通常のクラウド)
 *      → Prisma 既定の TCP 5432 ドライバ (libpq 互換)
 *
 * spec.md §6.3: テナント越え参照を防ぐため、tenant-scoped モデルへの
 * findFirst / findMany / count / findUnique は where に tenantId が
 * 含まれていなければ実行時エラーを投げる (defense-in-depth)。
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof buildClient> | undefined;
}

function shouldUseNeonAdapter(): boolean {
  if (process.env.USE_NEON_HTTPS === '1') return true;
  const url = process.env.DATABASE_URL ?? '';
  return /neon\.tech/.test(url) && process.env.NODE_ENV === 'production';
}

function buildClient() {
  const log: ('warn' | 'error')[] =
    process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'];

  let base: PrismaClient;
  if (shouldUseNeonAdapter()) {
    // Node.js (non-Edge) 環境では WebSocket 実装を ws に差し替えると
    // @neondatabase/serverless が HTTPS pooled 接続を確立できる。
    neonConfig.webSocketConstructor = ws as unknown as typeof globalThis.WebSocket;
    // 一部ホスティング (Pro-Web Plesk 等) は WebSocket upgrade を遮断するため、
    // クエリ実行を HTTPS fetch (POST /sql) にフォールバック.
    // 参考: https://neon.tech/docs/serverless/serverless-driver
    neonConfig.poolQueryViaFetch = true;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    base = new PrismaClient({ adapter, log });
  } else {
    base = new PrismaClient({ log });
  }

  return base.$extends({
    name: 'tenant-guard',
    query: {
      $allModels: {
        async findFirst({ model, args, query }) {
          assertTenantScoped(model, 'findFirst', args);
          return query(args);
        },
        async findMany({ model, args, query }) {
          assertTenantScoped(model, 'findMany', args);
          return query(args);
        },
        async count({ model, args, query }) {
          assertTenantScoped(model, 'count', args);
          return query(args);
        },
        async findUnique({ model, args, query }) {
          assertTenantScoped(model, 'findUnique', args);
          return query(args);
        },
      },
    },
  });
}

export const prisma = globalThis.__prisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export { TENANT_SCOPED_MODELS };
