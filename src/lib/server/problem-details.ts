import { NextResponse } from 'next/server';

/**
 * RFC 7807 Problem Details for HTTP APIs.
 * spec.md §3.5 のエラーコードに対応する標準レスポンスビルダー。
 *
 * すべての非 2xx は本ヘルパー経由で application/problem+json を返す。
 */

export type ProblemCode =
  | 'invalid_input'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'url_blocked'
  | 'rate_limited'
  | 'upstream_error'
  | 'service_unavailable'
  | 'internal_error';

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** zod 等の validation エラー詳細 */
  errors?: unknown;
  /** 任意の追加コンテキスト */
  [key: string]: unknown;
}

const STATUS: Record<ProblemCode, number> = {
  invalid_input: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  url_blocked: 422,
  rate_limited: 429,
  upstream_error: 502,
  service_unavailable: 503,
  internal_error: 500,
};

const TITLE: Record<ProblemCode, string> = {
  invalid_input: 'Invalid input',
  unauthorized: 'Authentication required',
  forbidden: 'Forbidden',
  not_found: 'Not found',
  conflict: 'Conflict',
  url_blocked: 'URL blocked',
  rate_limited: 'Rate limit exceeded',
  upstream_error: 'Upstream service error',
  service_unavailable: 'Service unavailable',
  internal_error: 'Internal server error',
};

export interface BuildProblemOptions {
  detail?: string;
  instance?: string;
  errors?: unknown;
  /** 追加のフィールドを Problem body にマージ */
  extras?: Record<string, unknown>;
}

export function buildProblemBody(
  code: ProblemCode,
  opts: BuildProblemOptions = {},
): ProblemBody {
  const body: ProblemBody = {
    type: `urn:problem:sct:${code}`,
    title: TITLE[code],
    status: STATUS[code],
  };
  if (opts.detail !== undefined) body.detail = opts.detail;
  if (opts.instance !== undefined) body.instance = opts.instance;
  if (opts.errors !== undefined) body.errors = opts.errors;
  if (opts.extras) {
    for (const [k, v] of Object.entries(opts.extras)) body[k] = v;
  }
  return body;
}

export function problemResponse(code: ProblemCode, opts: BuildProblemOptions = {}): NextResponse {
  const body = buildProblemBody(code, opts);
  return NextResponse.json(body, {
    status: body.status,
    headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
  });
}
