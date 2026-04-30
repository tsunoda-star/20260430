import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Phase 5 / Cycle 5.2: 結合テスト専用 vitest 設定.
 *
 * - tests/integration/ 以下のみを include
 * - PostgreSQL コンテナ + DATABASE_URL 必須
 * - 直列実行 (DB tear-down → migrate → seed → tests を直列に)
 *
 * Run:
 *   docker compose up -d postgres
 *   npm run prisma:migrate -- deploy   (or migrate dev for fresh schema)
 *   npm run prisma:seed
 *   npm run test:integration
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    fileParallelism: false, // DB 共有のため直列実行
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
