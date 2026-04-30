import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        // 以下は Phase 5 / Cycle 5.2 結合テストで検証する (DB / Next.js runtime / DOM 必須)
        'src/app/**', // Next.js Route Handlers (NextRequest + Prisma 必須)
        'src/components/**', // React UI (jsdom + RTL 必須)
        'src/hooks/**', // React hooks
        'src/lib/server/db.ts', // Prisma client init
        'src/lib/server/audit.ts', // Prisma write
        'src/lib/server/tenant.ts', // Prisma upsert
        'src/lib/server/session.ts', // jose JWKS fetch
        'src/lib/server/exporters/loader.ts', // Prisma findFirst
        'src/lib/auth/cc-auth.ts', // env-driven config
        'src/lib/auth/session.ts', // Cognito JWKS verify
        'src/lib/auth/role-context.tsx', // React context (jsdom 必須)
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
