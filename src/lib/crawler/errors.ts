/**
 * Crawler/SSRF 専用エラー型。
 * spec.md §3.5 のエラーコードに対応:
 *   - URLBlockedError → 422 url_blocked
 *   - UpstreamError   → 502 upstream_error
 */

export type UrlBlockReason =
  | 'invalid_protocol'
  | 'invalid_port'
  | 'private_or_reserved_ip'
  | 'internal_hostname'
  | 'redirect_loop'
  | 'dns_resolution_failed'
  | 'content_type_not_allowed'
  | 'response_too_large'
  | 'timeout';

export class UrlBlockedError extends Error {
  readonly code = 'url_blocked' as const;
  readonly reason: UrlBlockReason;
  readonly url: string;

  constructor(reason: UrlBlockReason, url: string, message?: string) {
    super(message ?? `URL blocked (${reason}): ${url}`);
    this.name = 'UrlBlockedError';
    this.reason = reason;
    this.url = url;
  }
}

export class UpstreamError extends Error {
  readonly code = 'upstream_error' as const;
  readonly url: string;

  constructor(url: string, message: string) {
    super(message);
    this.name = 'UpstreamError';
    this.url = url;
  }
}
