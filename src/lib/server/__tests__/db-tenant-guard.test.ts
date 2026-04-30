import { describe, it, expect } from 'vitest';
import {
  TENANT_SCOPED_MODELS,
  TenantScopeViolation,
  assertTenantScoped,
} from '../db-tenant-guard';

describe('TENANT_SCOPED_MODELS', () => {
  it('lists all multi-tenant models from spec.md §2', () => {
    expect(TENANT_SCOPED_MODELS.has('User')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('Company')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('Assessment')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('AssessmentItem')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('AiChat')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('AuditLog')).toBe(true);
  });

  it('does not include master / shared models', () => {
    expect(TENANT_SCOPED_MODELS.has('Tenant')).toBe(false);
    expect(TENANT_SCOPED_MODELS.has('Guideline')).toBe(false);
    expect(TENANT_SCOPED_MODELS.has('GuidelineVersion')).toBe(false);
    expect(TENANT_SCOPED_MODELS.has('ControlItem')).toBe(false);
  });
});

describe('assertTenantScoped', () => {
  it('passes when where contains tenantId directly', () => {
    expect(() =>
      assertTenantScoped('Company', 'findFirst', { where: { id: 1n, tenantId: 7n } }),
    ).not.toThrow();
  });

  it('passes when tenantId is nested in AND clause', () => {
    expect(() =>
      assertTenantScoped('Assessment', 'findMany', {
        where: { AND: [{ tenantId: 7n }, { status: 'in_progress' }] },
      }),
    ).not.toThrow();
  });

  it('passes when tenantId is nested in OR clause', () => {
    expect(() =>
      assertTenantScoped('AssessmentItem', 'findMany', {
        where: { OR: [{ tenantId: 1n }, { tenantId: 2n }] },
      }),
    ).not.toThrow();
  });

  it('throws when args is undefined for tenant-scoped model', () => {
    expect(() => assertTenantScoped('Company', 'findMany', undefined)).toThrow(
      TenantScopeViolation,
    );
  });

  it('throws when where is missing entirely', () => {
    expect(() => assertTenantScoped('Company', 'findFirst', {})).toThrow(TenantScopeViolation);
  });

  it('throws when where lacks tenantId', () => {
    expect(() =>
      assertTenantScoped('Assessment', 'findFirst', { where: { id: 1n } }),
    ).toThrow(TenantScopeViolation);
  });

  it('does NOT enforce on shared / master models', () => {
    expect(() =>
      assertTenantScoped('Guideline', 'findMany', { where: { isActive: true } }),
    ).not.toThrow();
    expect(() =>
      assertTenantScoped('Tenant', 'findUnique', { where: { externalId: 'org_1' } }),
    ).not.toThrow();
  });

  it('does not crash on unknown model name', () => {
    expect(() =>
      assertTenantScoped('SomethingNew', 'findMany', { where: {} }),
    ).not.toThrow();
  });

  it('throws TenantScopeViolation with helpful message', () => {
    try {
      assertTenantScoped('AuditLog', 'findMany', { where: {} });
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TenantScopeViolation);
      expect((e as TenantScopeViolation).model).toBe('AuditLog');
      expect((e as TenantScopeViolation).operation).toBe('findMany');
      expect((e as Error).message).toContain('AuditLog.findMany');
    }
  });
});
