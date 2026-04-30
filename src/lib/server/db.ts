import { PrismaClient } from '@prisma/client';
import { assertTenantScoped, TENANT_SCOPED_MODELS } from './db-tenant-guard';

/**
 * Prisma client singleton.
 * Next.js dev では HMR 中に複数インスタンス生成されるのを抑止する定型パターン。
 *
 * 本ファイルは Server Component / Route Handler 専用 (Edge runtime 不可)。
 * Edge runtime (middleware) 用には別途 fetch ベースの DB アクセス層を用意する。
 *
 * spec.md §6.3: テナント越え参照を防ぐため、tenant-scoped モデルへの
 * findFirst / findMany / count / findUnique は where に tenantId が
 * 含まれていなければ実行時エラーを投げる (defense-in-depth)。
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof buildClient> | undefined;
}

function buildClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
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
