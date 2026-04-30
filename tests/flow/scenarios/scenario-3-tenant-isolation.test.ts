import { describe, it } from 'vitest';

/**
 * F-04: テナント分離フロー.
 * flow-test-design.md §5 に対応。
 *
 * 想定 Step:
 *   1. 同一 domain で 2 つの Tenant を作成 (例: Tenant A / Tenant B)
 *   2. 各 Tenant が同じ会社プロフィールを推定 → 別 Assessment を保有
 *   3. Tenant A の Admin から Tenant B の Assessment を読もうとすると null (404 相当)
 *   4. Prisma extension (TenantScopeViolation) が tenantId 強制を発動
 *
 * Cycle 5.4 完了時には RLS 相当の挙動を E2E で検証する。
 */

describe('F-04: cross-tenant isolation', () => {
  it.todo('two tenants store independent assessments for the same domain');
  it.todo('tenant A cannot read tenant B assessments (loadAssessmentExportData → null)');
  it.todo('Prisma TenantScopeViolation when tenantId omitted on findFirst');
});
