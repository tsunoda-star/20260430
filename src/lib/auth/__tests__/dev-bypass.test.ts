import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isDevAuthBypassEnabled,
  devSessionUser,
  DEV_USER_ROLE_ENV,
} from '../dev-bypass';

describe('isDevAuthBypassEnabled', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when DEV_AUTH_BYPASS is not set or != "1"', () => {
    vi.stubEnv('DEV_AUTH_BYPASS', '0');
    expect(isDevAuthBypassEnabled()).toBe(false);
    vi.stubEnv('DEV_AUTH_BYPASS', 'yes');
    expect(isDevAuthBypassEnabled()).toBe(false);
    vi.stubEnv('DEV_AUTH_BYPASS', '');
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it('returns true when DEV_AUTH_BYPASS=1 (NODE_ENV is build-time replaced)', () => {
    // Next.js は process.env.NODE_ENV を build 時に静的置換するため、
    // bypass の判定は DEV_AUTH_BYPASS だけに依存する.
    // 運用上は production env に DEV_AUTH_BYPASS=1 を入れないことで安全性を担保.
    vi.stubEnv('DEV_AUTH_BYPASS', '1');
    expect(isDevAuthBypassEnabled()).toBe(true);
  });
});

describe('devSessionUser', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns admin role by default', () => {
    const u = devSessionUser();
    expect(u.role).toBe('admin');
    expect(u.sub).toBe('dev-user-001');
    expect(u.orgId).toBe('dev-tenant');
    expect(u.email).toContain('@local.example');
  });

  it('respects DEV_AUTH_BYPASS_ROLE when valid', () => {
    for (const role of ['owner', 'admin', 'editor', 'reviewer', 'viewer'] as const) {
      vi.stubEnv(DEV_USER_ROLE_ENV, role);
      expect(devSessionUser().role).toBe(role);
    }
  });

  it('falls back to admin on unknown role string', () => {
    vi.stubEnv(DEV_USER_ROLE_ENV, 'superuser');
    expect(devSessionUser().role).toBe('admin');
  });
});
