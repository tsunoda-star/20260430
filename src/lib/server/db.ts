import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 * Next.js dev では HMR 中に複数インスタンス生成されるのを抑止する定型パターン。
 *
 * 本ファイルは Server Component / Route Handler 専用 (Edge runtime 不可)。
 * Edge runtime (middleware) 用には別途 fetch ベースの DB アクセス層を用意する。
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
