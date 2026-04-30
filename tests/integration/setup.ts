import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * Phase 5 / Cycle 5.2: 結合テストグローバルセットアップ.
 *
 * - DATABASE_URL 接続確認 (なければテスト全体を skip 推奨)
 * - 各テストファイル先頭で再利用するため 1 つの prisma instance を export
 * - tear-down 戦略: AssessmentItem → AiChat → AuditLog → AssessmentGuideline →
 *   Assessment → Company → User → Tenant の順で削除 (FK 順)
 *   GuidelineVersion / Guideline / ControlItem は seed 由来のため保持
 */

export const integrationPrisma = new PrismaClient({
  log: ['error'],
});

export async function resetTenantData(): Promise<void> {
  await integrationPrisma.$transaction([
    integrationPrisma.aiChat.deleteMany({}),
    integrationPrisma.assessmentItem.deleteMany({}),
    integrationPrisma.assessmentGuideline.deleteMany({}),
    integrationPrisma.assessment.deleteMany({}),
    integrationPrisma.auditLog.deleteMany({}),
    integrationPrisma.company.deleteMany({}),
    integrationPrisma.user.deleteMany({}),
    integrationPrisma.tenant.deleteMany({}),
  ]);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Start the integration DB with `docker compose up -d postgres`.',
    );
  }
  await integrationPrisma.$connect();
});

afterAll(async () => {
  await integrationPrisma.$disconnect();
});
