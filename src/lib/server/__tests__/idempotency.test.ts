import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getIdempotent,
  setIdempotent,
  isValidIdempotencyKey,
  __resetIdempotencyStore,
} from '../idempotency';

describe('isValidIdempotencyKey', () => {
  it('accepts allowed charset within length', () => {
    expect(isValidIdempotencyKey('abc-123_:.X')).toBe(true);
    expect(isValidIdempotencyKey('a'.repeat(256))).toBe(true);
  });

  it('rejects empty / too long / disallowed chars', () => {
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey(undefined)).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey('a'.repeat(257))).toBe(false);
    expect(isValidIdempotencyKey('has space')).toBe(false);
    expect(isValidIdempotencyKey('日本語')).toBe(false);
  });
});

describe('idempotency store', () => {
  beforeEach(() => {
    __resetIdempotencyStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetIdempotencyStore();
  });

  it('returns undefined when key is unseen', () => {
    expect(getIdempotent(1n, 'k')).toBeUndefined();
  });

  it('returns stored payload for the same tenant + key', () => {
    setIdempotent(1n, 'k', { id: 'A1' });
    expect(getIdempotent(1n, 'k')).toEqual({ id: 'A1' });
  });

  it('isolates entries per tenant', () => {
    setIdempotent(1n, 'k', 'tenant1');
    setIdempotent(2n, 'k', 'tenant2');
    expect(getIdempotent(1n, 'k')).toBe('tenant1');
    expect(getIdempotent(2n, 'k')).toBe('tenant2');
  });

  it('expires entries after 24h', () => {
    setIdempotent(1n, 'k', 'value');
    expect(getIdempotent(1n, 'k')).toBe('value');
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    expect(getIdempotent(1n, 'k')).toBeUndefined();
  });

  it('keeps entries within 24h', () => {
    setIdempotent(1n, 'k', 'value');
    vi.advanceTimersByTime(20 * 60 * 60 * 1000);
    expect(getIdempotent(1n, 'k')).toBe('value');
  });
});
