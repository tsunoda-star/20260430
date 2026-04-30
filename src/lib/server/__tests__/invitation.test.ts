import { describe, it, expect } from 'vitest';
import {
  generateInvitationToken,
  INVITATION_TOKEN_BYTES,
  INVITATION_TTL_HOURS,
} from '../invitation';

describe('generateInvitationToken', () => {
  it('produces a hex token of expected length', () => {
    const t = generateInvitationToken();
    expect(t.token).toMatch(/^[0-9a-f]+$/);
    expect(t.token.length).toBe(INVITATION_TOKEN_BYTES * 2);
  });

  it('expires roughly INVITATION_TTL_HOURS hours later', () => {
    const before = Date.now();
    const t = generateInvitationToken();
    const expiresAt = Date.parse(t.expiresAt);
    const expectedMs = INVITATION_TTL_HOURS * 60 * 60 * 1000;
    expect(expiresAt - before).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(expiresAt - before).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('builds invite URL with token and origin trim', () => {
    const t = generateInvitationToken();
    expect(t.url('https://example.com/')).toBe(
      `https://example.com/auth/invite?token=${t.token}`,
    );
    expect(t.url('https://example.com')).toBe(
      `https://example.com/auth/invite?token=${t.token}`,
    );
  });

  it('emits unique tokens on each call', () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
  });
});
