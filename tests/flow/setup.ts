import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * Phase 5 / Cycle 5.4: フローテストグローバルセットアップ.
 *
 * - DATABASE_URL 接続必須 (なければ throw)
 * - integration スイートとは別の Prisma instance を共有
 * - 各シナリオは beforeAll/beforeEach 内で resetTenantData を呼ぶ
 */

export const flowPrisma = new PrismaClient({ log: ['error'] });

export async function resetTenantData(): Promise<void> {
  await flowPrisma.$transaction([
    flowPrisma.aiChat.deleteMany({}),
    flowPrisma.assessmentItem.deleteMany({}),
    flowPrisma.assessmentGuideline.deleteMany({}),
    flowPrisma.assessment.deleteMany({}),
    flowPrisma.auditLog.deleteMany({}),
    flowPrisma.company.deleteMany({}),
    flowPrisma.user.deleteMany({}),
    flowPrisma.tenant.deleteMany({}),
  ]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Start the flow DB with `docker compose up -d postgres`.',
    );
  }
  await flowPrisma.$connect();
});

afterAll(async () => {
  await flowPrisma.$disconnect();
});
