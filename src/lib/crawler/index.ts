import { safeFetch, type SafeFetchOptions } from './safe-fetch';
import { extract, type CrawlExtraction } from './extract';
import { UrlBlockedError, UpstreamError } from './errors';

/**
 * 高レベル crawler。
 * spec.md §4.1: トップページ + (任意で) /about, /privacy を順次取得し抽出。
 *
 * Cycle 2.2 (本コミット) はトップページのみ。
 * 補助ページ取得 (/about, /privacy) は Cycle 2.3 (LLM 推定) で必要に応じて拡張。
 */

export interface CrawlResult {
  url: string;
  finalUrl: string;
  hops: number;
  extraction: CrawlExtraction;
}

export async function crawl(rawUrl: string, opts: SafeFetchOptions = {}): Promise<CrawlResult> {
  const fetched = await safeFetch(rawUrl, opts);
  const extraction = extract(fetched.body);
  return {
    url: rawUrl,
    finalUrl: fetched.finalUrl,
    hops: fetched.hops,
    extraction,
  };
}

export { safeFetch, validateUrl } from './safe-fetch';
export { extract } from './extract';
export { UrlBlockedError, UpstreamError } from './errors';
export type { UrlBlockReason } from './errors';
export type { SafeFetchOptions, SafeFetchResult } from './safe-fetch';
export type { CrawlExtraction } from './extract';
