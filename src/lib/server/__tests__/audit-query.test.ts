import { describe, it, expect } from 'vitest';
import { AuditQuerySchema, buildAuditWhere } from '../audit-query';

describe('AuditQuerySchema', () => {
  it('uses defaults when nothing is provided', () => {
    const r = AuditQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(50);
  });

  it('coerces page/pageSize from string', () => {
    const r = AuditQuerySchema.parse({ page: '3', pageSize: '20' });
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(20);
  });

  it('rejects malformed dates', () => {
    expect(AuditQuerySchema.safeParse({ from: '2026/04/30' }).success).toBe(false);
    expect(AuditQuerySchema.safeParse({ to: 'tomorrow' }).success).toBe(false);
  });

  it('rejects oversized pageSize', () => {
    expect(AuditQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('rejects non-numeric userId', () => {
    expect(AuditQuerySchema.safeParse({ userId: 'abc' }).success).toBe(false);
  });
});

describe('buildAuditWhere', () => {
  it('includes only tenantId when query is empty', () => {
    const { where, skip, take } = buildAuditWhere(7n, AuditQuerySchema.parse({}));
    expect(where).toEqual({ tenantId: 7n });
    expect(skip).toBe(0);
    expect(take).toBe(50);
  });

  it('applies action / resourceType / userId filters', () => {
    const { where } = buildAuditWhere(
      1n,
      AuditQuerySchema.parse({
        action: 'company.upsert',
        resourceType: 'company',
        userId: '42',
      }),
    );
    expect(where).toMatchObject({
      tenantId: 1n,
      action: 'company.upsert',
      resourceType: 'company',
      userId: 42n,
    });
  });

  it('builds inclusive ts range when from / to provided', () => {
    const { where } = buildAuditWhere(
      1n,
      AuditQuerySchema.parse({ from: '2026-04-01', to: '2026-04-30' }),
    );
    expect(where.ts?.gte?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(where.ts?.lte?.toISOString()).toBe('2026-04-30T23:59:59.999Z');
  });

  it('only sets gte when only from is provided', () => {
    const { where } = buildAuditWhere(1n, AuditQuerySchema.parse({ from: '2026-04-15' }));
    expect(where.ts?.gte).toBeInstanceOf(Date);
    expect(where.ts?.lte).toBeUndefined();
  });

  it('computes skip from page * pageSize', () => {
    const { skip, take } = buildAuditWhere(
      1n,
      AuditQuerySchema.parse({ page: '4', pageSize: '25' }),
    );
    expect(skip).toBe(75);
    expect(take).toBe(25);
  });
});
