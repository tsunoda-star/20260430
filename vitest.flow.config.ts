import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Phase 5 / Cycle 5.4: フローテスト専用 vitest 設定.
 *
 * - tests/flow/ 以下のみを include
 * - 実 DB / 実 LLM (degraded fallback 可) / Prisma 直接アクセスで業務シナリオを通す
 * - 各シナリオはセットアップから tear-down まで完結 (直列実行)
 *
 * Run:
 *   docker compose up -d postgres
 *   DATABASE_URL=... npx prisma migrate deploy
 *   DATABASE_URL=... npm run prisma:seed
 *   npm run test:flow
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/flow/**/*.test.ts'],
    setupFiles: ['tests/flow/setup.ts'],
    fileParallelism: false, // DB 共有のため直列
    testTimeout: 60_000, // LLM/SSRF/PDF を含むため余裕を取る
    hookTimeout: 30_000,
  },
});
