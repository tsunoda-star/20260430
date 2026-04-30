import { describe, it, expect } from 'vitest';
import { maskSensitive, maskObject } from '../masking';

describe('maskSensitive', () => {
  it('masks email addresses', () => {
    const r = maskSensitive('連絡先: alice@example.co.jp / bob.smith+tag@sub.example.com');
    expect(r.masked).not.toContain('alice@');
    expect(r.masked).not.toContain('bob.smith');
    expect(r.masked).toContain('<email>');
    expect(r.hits.find((h) => h.name === 'email')?.count).toBe(2);
  });

  it('masks JP phone numbers', () => {
    const r = maskSensitive('Tel: 03-1234-5678 / 090 1234 5678');
    expect(r.masked).not.toMatch(/03-1234/);
    expect(r.masked).toContain('<phone>');
    expect(r.hits.find((h) => h.name === 'phone-jp')?.count).toBeGreaterThanOrEqual(1);
  });

  it('masks AWS access key', () => {
    const r = maskSensitive('key=AKIAABCDEFGHIJKLMNOP rest');
    expect(r.masked).toContain('<aws-key>');
    expect(r.masked).not.toContain('AKIAABCDEFGHIJKLMNOP');
    expect(r.hits.some((h) => h.name === 'aws-access-key')).toBe(true);
  });

  it('masks api/secret/token assignments', () => {
    const r = maskSensitive(
      'config: api_key="sk-veryLongTokenValue1234" and SECRET = \'abcdef0123456789ZZZZ\'',
    );
    expect(r.masked).toContain('<secret>');
    expect(r.masked).not.toContain('sk-veryLongTokenValue1234');
  });

  it('masks long card-like number runs', () => {
    const r = maskSensitive('カード: 4111 1111 1111 1111 を入力');
    expect(r.masked).toContain('<cc>');
    expect(r.masked).not.toMatch(/4111 1111 1111 1111/);
  });

  it('returns hit summary with names and counts', () => {
    const r = maskSensitive('a@x.co と b@x.co と AKIAABCDEFGHIJKLMNOP');
    const names = r.hits.map((h) => h.name).sort();
    expect(names).toEqual(['aws-access-key', 'email']);
    expect(r.hits.find((h) => h.name === 'email')?.count).toBe(2);
  });

  it('leaves clean text untouched', () => {
    const text = '株式会社 Acme は SaaS を提供しています。';
    const r = maskSensitive(text);
    expect(r.masked).toBe(text);
    expect(r.hits).toEqual([]);
  });
});

describe('maskObject', () => {
  it('masks string fields recursively', () => {
    const o = {
      name: 'Acme',
      contact: { email: 'admin@acme.example' },
      tags: ['support@acme.example', 'public'],
      count: 42,
      active: true,
    };
    const m = maskObject(o);
    expect(m.contact.email).toBe('<email>');
    expect(m.tags[0]).toBe('<email>');
    expect(m.tags[1]).toBe('public');
    expect(m.count).toBe(42);
    expect(m.active).toBe(true);
  });

  it('handles null / undefined safely', () => {
    expect(maskObject(null)).toBe(null);
    expect(maskObject(undefined)).toBe(undefined);
  });
});
