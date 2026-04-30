import { describe, it, expect } from 'vitest';
import { extract } from '../extract';

describe('extract', () => {
  it('reads title, meta description, and og tags', () => {
    const html = `<!doctype html>
      <html><head>
        <title>Acme Inc.</title>
        <meta name="description" content="製造業向け SaaS。" />
        <meta property="og:title" content="Acme OG" />
        <meta property="og:description" content="OG desc" />
      </head><body><h1>Acme</h1><p>about</p></body></html>`;
    const r = extract(html);
    expect(r.title).toBe('Acme Inc.');
    expect(r.description).toBe('製造業向け SaaS。');
    expect(r.ogTitle).toBe('Acme OG');
    expect(r.ogDescription).toBe('OG desc');
    expect(r.h1).toEqual(['Acme']);
    expect(r.textSnippet).toContain('about');
  });

  it('strips script / style content from textSnippet', () => {
    const html = `<html><body>
      <script>const secret = "leak";</script>
      <style>.x{color:red}</style>
      <p>visible</p>
    </body></html>`;
    const r = extract(html);
    expect(r.textSnippet).not.toContain('secret');
    expect(r.textSnippet).not.toContain('color:red');
    expect(r.textSnippet).toContain('visible');
  });

  it('truncates body text snippet at 4000 chars', () => {
    const big = 'x'.repeat(10_000);
    const r = extract(`<html><body><p>${big}</p></body></html>`);
    expect(r.textSnippet.length).toBe(4000);
  });

  it('returns empty fields when nothing matches', () => {
    const r = extract('<html><body></body></html>');
    expect(r.title).toBe('');
    expect(r.description).toBe('');
    expect(r.h1).toEqual([]);
  });
});
