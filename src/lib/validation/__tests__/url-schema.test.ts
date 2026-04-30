import { describe, it, expect } from 'vitest';
import { urlSchema } from '../url-schema';

describe('urlSchema', () => {
  it('accepts a normal https URL', () => {
    const r = urlSchema.safeParse({ url: 'https://example.com/path?q=1' });
    expect(r.success).toBe(true);
  });

  it('rejects http (https only)', () => {
    const r = urlSchema.safeParse({ url: 'http://example.com' });
    expect(r.success).toBe(false);
  });

  it('rejects malformed URL', () => {
    expect(urlSchema.safeParse({ url: 'not-a-url' }).success).toBe(false);
    expect(urlSchema.safeParse({ url: '' }).success).toBe(false);
    expect(urlSchema.safeParse({ url: 'https://' }).success).toBe(false);
  });

  it('rejects non-https schemes (file/ftp/javascript)', () => {
    expect(urlSchema.safeParse({ url: 'file:///etc/passwd' }).success).toBe(false);
    expect(urlSchema.safeParse({ url: 'ftp://example.com' }).success).toBe(false);
    expect(urlSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('rejects URL longer than 2048 chars', () => {
    const big = `https://example.com/${'a'.repeat(2100)}`;
    const r = urlSchema.safeParse({ url: big });
    expect(r.success).toBe(false);
  });

  it('trims surrounding whitespace before validating', () => {
    const r = urlSchema.safeParse({ url: '  https://example.com/  ' });
    expect(r.success).toBe(true);
  });

  it('produces a Japanese error message for empty input', () => {
    const r = urlSchema.safeParse({ url: '' });
    if (!r.success) {
      const messages = r.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('URL'))).toBe(true);
    }
  });

  it('rejects when url is missing', () => {
    expect(urlSchema.safeParse({}).success).toBe(false);
  });
});
