import { describe, it, expect, vi } from 'vitest';
import { safeFetch, validateUrl } from '../safe-fetch';
import { UrlBlockedError } from '../errors';

/** node:dns 互換のスタブを生成 */
function makeResolver(map: Record<string, { v4?: string[]; v6?: string[] }>) {
  return {
    resolve4: vi.fn(async (host: string) => {
      const e = map[host]?.v4;
      if (!e) throw new Error('ENOTFOUND');
      return e;
    }),
    resolve6: vi.fn(async (host: string) => {
      const e = map[host]?.v6;
      if (!e) throw new Error('ENOTFOUND');
      return e;
    }),
  };
}

/** fetch スタブ生成: 各 URL に対するレスポンス map */
function makeFetcher(plan: Record<string, () => Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = input instanceof URL ? input.toString() : String(input);
    const factory = plan[url];
    if (!factory) throw new Error(`unexpected fetch: ${url}`);
    return factory();
  }) as typeof fetch;
}

function htmlResponse(body = '<html><title>OK</title><body>hi</body></html>'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

describe('validateUrl', () => {
  it('blocks non-http(s) protocols', async () => {
    await expect(validateUrl('file:///etc/passwd')).rejects.toMatchObject({
      reason: 'invalid_protocol',
    });
    await expect(validateUrl('ftp://example.com')).rejects.toMatchObject({
      reason: 'invalid_protocol',
    });
  });

  it('blocks non-standard ports', async () => {
    await expect(validateUrl('http://example.com:8080/')).rejects.toMatchObject({
      reason: 'invalid_port',
    });
  });

  it('blocks IP literal in hostname when private', async () => {
    await expect(validateUrl('http://10.0.0.1/')).rejects.toMatchObject({
      reason: 'private_or_reserved_ip',
    });
    // 169.254.169.254 は BLOCK_HOSTS にも含まれるため `internal_hostname` で先に弾かれる
    await expect(
      validateUrl('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toBeInstanceOf(UrlBlockedError);
  });

  it('blocks internal hostnames before DNS', async () => {
    await expect(validateUrl('http://localhost/')).rejects.toMatchObject({
      reason: 'internal_hostname',
    });
    await expect(validateUrl('https://printer.local/')).rejects.toMatchObject({
      reason: 'internal_hostname',
    });
  });

  it('blocks when DNS resolves to private IP', async () => {
    const resolver = makeResolver({ 'rebind.example': { v4: ['10.0.0.5'] } });
    await expect(validateUrl('http://rebind.example/', resolver)).rejects.toMatchObject({
      reason: 'private_or_reserved_ip',
    });
  });

  it('blocks when DNS resolution fails', async () => {
    const resolver = makeResolver({});
    await expect(validateUrl('http://nope.example/', resolver)).rejects.toMatchObject({
      reason: 'dns_resolution_failed',
    });
  });

  it('passes valid public URL', async () => {
    const resolver = makeResolver({ 'example.com': { v4: ['93.184.216.34'] } });
    await expect(validateUrl('https://example.com/', resolver)).resolves.toMatchObject({
      ips: ['93.184.216.34'],
    });
  });
});

describe('safeFetch', () => {
  it('AC-S7-01: blocks AWS IMDS literal', async () => {
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(
      UrlBlockedError,
    );
  });

  it('AC-S7-02: blocks RFC1918 literal', async () => {
    await expect(safeFetch('http://10.0.0.1/')).rejects.toBeInstanceOf(UrlBlockedError);
  });

  it('AC-S7-03: blocks redirect chain hopping into IMDS', async () => {
    const resolver = makeResolver({
      'attacker.example': { v4: ['93.184.216.34'] },
    });
    const fetcher = makeFetcher({
      'https://attacker.example/': () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data/' },
        }),
    });
    await expect(
      safeFetch('https://attacker.example/', { resolver, fetcher }),
    ).rejects.toBeInstanceOf(UrlBlockedError);
  });

  it('AC-S7-04: pinning re-validates DNS on each hop (rebound 2nd-call goes private)', async () => {
    let call = 0;
    const resolver = {
      resolve4: vi.fn(async () => {
        call++;
        return call === 1 ? ['93.184.216.34'] : ['10.0.0.7'];
      }),
      resolve6: vi.fn(async () => {
        throw new Error('ENOTFOUND');
      }),
    };
    const fetcher = makeFetcher({
      'https://rebind.example/': () =>
        new Response(null, { status: 302, headers: { location: 'https://rebind.example/x' } }),
    });
    await expect(
      safeFetch('https://rebind.example/', { resolver, fetcher }),
    ).rejects.toMatchObject({ reason: 'private_or_reserved_ip' });
  });

  it('blocks exceeding redirect budget (>3 hops)', async () => {
    const resolver = makeResolver({ 'a.example': { v4: ['93.184.216.34'] } });
    const fetcher = makeFetcher({
      'https://a.example/0': () =>
        new Response(null, { status: 302, headers: { location: 'https://a.example/1' } }),
      'https://a.example/1': () =>
        new Response(null, { status: 302, headers: { location: 'https://a.example/2' } }),
      'https://a.example/2': () =>
        new Response(null, { status: 302, headers: { location: 'https://a.example/3' } }),
      'https://a.example/3': () =>
        new Response(null, { status: 302, headers: { location: 'https://a.example/4' } }),
    });
    await expect(
      safeFetch('https://a.example/0', { resolver, fetcher, maxRedirects: 3 }),
    ).rejects.toMatchObject({ reason: 'redirect_loop' });
  });

  it('rejects disallowed content-type', async () => {
    const resolver = makeResolver({ 'app.example': { v4: ['93.184.216.34'] } });
    const fetcher = makeFetcher({
      'https://app.example/api': () =>
        new Response('{"x":1}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    await expect(
      safeFetch('https://app.example/api', { resolver, fetcher }),
    ).rejects.toMatchObject({ reason: 'content_type_not_allowed' });
  });

  it('rejects oversize via content-length header', async () => {
    const resolver = makeResolver({ 'big.example': { v4: ['93.184.216.34'] } });
    const fetcher = makeFetcher({
      'https://big.example/': () =>
        new Response('x', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            'content-length': String(10 * 1024 * 1024),
          },
        }),
    });
    await expect(safeFetch('https://big.example/', { resolver, fetcher })).rejects.toMatchObject({
      reason: 'response_too_large',
    });
  });

  it('returns body on a clean public fetch', async () => {
    const resolver = makeResolver({ 'ok.example': { v4: ['93.184.216.34'] } });
    const fetcher = makeFetcher({ 'https://ok.example/': () => htmlResponse() });
    const r = await safeFetch('https://ok.example/', { resolver, fetcher });
    expect(r.status).toBe(200);
    expect(r.body).toContain('<title>OK</title>');
    expect(r.hops).toBe(0);
  });
});
