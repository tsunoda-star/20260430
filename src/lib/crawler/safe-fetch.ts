import dns from 'node:dns/promises';
import { UrlBlockedError, UpstreamError } from './errors';
import { BLOCK_HOSTS, isInternalHostname, isPrivateOrReservedIP } from './ip-blocklist';

/**
 * spec.md §7.3 SSRF-safe fetch.
 * deny-by-default + 多層防御:
 *   1. URL parse  (protocol/port/host)
 *   2. internal hostname block
 *   3. DNS resolve → 全 IP を private/reserved 判定
 *   4. fetch (redirect manual / timeout / size limit / content-type allowlist)
 *   5. redirect 各 hop を再検証 (最大 3 hop)
 */

/** Node.js dns/promises 互換のサブセット (テスト用 stub と本物両対応) */
export interface DnsResolver {
  resolve4: (host: string) => Promise<string[]>;
  resolve6: (host: string) => Promise<string[]>;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set(['', '80', '443']);
const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml'];

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const DEFAULT_MAX_REDIRECTS = 3;
export const USER_AGENT = 'SecChecklistBot/1.0 (+https://security-checklist-tool.example)';

export interface SafeFetchOptions {
  /** node:dns 互換 (テスト時にモック差し替え可能) */
  resolver?: DnsResolver;
  /** fetch 互換 (テスト時にモック差し替え) */
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  hops: number;
}

/**
 * 1 ホップの URL に対する事前検証 (parse + DNS)。
 * 受理時は resolved IPs を返す。block 時は UrlBlockedError を投げる。
 */
export async function validateUrl(
  rawUrl: string,
  resolver: DnsResolver = dns as DnsResolver,
): Promise<{ url: URL; ips: string[] }> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new UrlBlockedError('invalid_protocol', rawUrl, 'URL parse failed');
  }
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    throw new UrlBlockedError('invalid_protocol', rawUrl);
  }
  if (!ALLOWED_PORTS.has(u.port)) {
    throw new UrlBlockedError('invalid_port', rawUrl);
  }
  const host = u.hostname.toLowerCase();
  if (BLOCK_HOSTS.has(host) || isInternalHostname(host)) {
    throw new UrlBlockedError('internal_hostname', rawUrl);
  }
  // hostname 自体が IP リテラルの場合は DNS せず直接判定
  // (URL.hostname は IPv6 を [::1] のように [] 付きで返さないが、URL 上は [...])
  const literalHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (/^[\d.]+$/.test(literalHost) || literalHost.includes(':')) {
    if (isPrivateOrReservedIP(literalHost)) {
      throw new UrlBlockedError('private_or_reserved_ip', rawUrl);
    }
    return { url: u, ips: [literalHost] };
  }
  // 通常ホスト名 → DNS 解決 (IPv4/IPv6 両方)
  let ips: string[] = [];
  try {
    const [v4, v6] = await Promise.allSettled([
      resolver.resolve4(host),
      resolver.resolve6(host),
    ]);
    if (v4.status === 'fulfilled') ips.push(...v4.value);
    if (v6.status === 'fulfilled') ips.push(...v6.value);
  } catch {
    throw new UrlBlockedError('dns_resolution_failed', rawUrl);
  }
  if (ips.length === 0) {
    throw new UrlBlockedError('dns_resolution_failed', rawUrl);
  }
  if (ips.some(isPrivateOrReservedIP)) {
    throw new UrlBlockedError('private_or_reserved_ip', rawUrl);
  }
  return { url: u, ips };
}

/** Content-Type ヘッダから主要 MIME タイプを抜き出す */
function pickMime(contentType: string | null): string {
  if (!contentType) return '';
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return mime;
}

/**
 * SSRF safe fetch + redirect 再検証付き取得。
 *
 * - redirect は manual で受け、Location を validateUrl で再検証して再帰
 * - timeout は AbortSignal.timeout
 * - レスポンスは Content-Length / 累計読込で 5MB 上限
 * - Content-Type allowlist 違反は url_blocked
 */
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const resolver: DnsResolver = opts.resolver ?? (dns as DnsResolver);
  const fetcher = opts.fetcher ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const { url } = await validateUrl(currentUrl, resolver);
    let res: Response;
    try {
      res = await fetcher(url.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'fetch failed';
      if (/timeout|AbortError/i.test(msg)) {
        throw new UrlBlockedError('timeout', currentUrl);
      }
      throw new UpstreamError(currentUrl, msg);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) {
        throw new UpstreamError(currentUrl, `redirect ${res.status} without Location`);
      }
      if (hop === maxRedirects) {
        throw new UrlBlockedError('redirect_loop', currentUrl);
      }
      currentUrl = new URL(loc, url).toString();
      continue;
    }

    const contentType = res.headers.get('content-type') ?? '';
    const mime = pickMime(contentType);
    if (!ALLOWED_CONTENT_TYPES.includes(mime)) {
      throw new UrlBlockedError('content_type_not_allowed', currentUrl);
    }

    const lenHeader = res.headers.get('content-length');
    if (lenHeader && Number(lenHeader) > maxBytes) {
      throw new UrlBlockedError('response_too_large', currentUrl);
    }

    // ストリーム読込 + サイズ上限
    const body = await readWithLimit(res, maxBytes, currentUrl);
    return { finalUrl: currentUrl, status: res.status, contentType, body, hops: hop };
  }
  // ループ脱出は redirect 過多のみ (ほぼ到達不能)
  throw new UrlBlockedError('redirect_loop', currentUrl);
}

async function readWithLimit(res: Response, maxBytes: number, url: string): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let received = 0;
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore cancel error
      }
      throw new UrlBlockedError('response_too_large', url);
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}
