import { describe, it, expect, beforeEach } from 'vitest';
import { integrationPrisma, resetTenantData } from '../setup';

/**
 * Cycle 5.2 サンプル: DB connectivity + tenant tear-down が機能するかの最小テスト.
 * 本番ロジックには触れず、結合テスト基盤そのものの正常性を確認する役割。
 */

describe('integration health', () => {
  beforeEach(async () => {
    await resetTenantData();
  });

  it('connects to PostgreSQL and reports server version', async () => {
    const result = await integrationPrisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    expect(result[0]?.version).toContain('PostgreSQL');
  });

  it('seed data is preserved after resetTenantData (27 guidelines)', async () => {
    const count = await integrationPrisma.guideline.count({ where: { isActive: true } });
    expect(count).toBeGreaterThanOrEqual(27);
  });

  it('tenant data is empty after reset', async () => {
    const tenants = await integrationPrisma.tenant.count();
    const companies = await integrationPrisma.company.count();
    const assessments = await integrationPrisma.assessment.count();
    expect(tenants).toBe(0);
    expect(companies).toBe(0);
    expect(assessments).toBe(0);
  });
});
