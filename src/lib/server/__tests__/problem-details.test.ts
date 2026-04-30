import { describe, it, expect } from 'vitest';
import { buildProblemBody, problemResponse } from '../problem-details';

describe('buildProblemBody', () => {
  it('maps codes to RFC7807 type / title / status', () => {
    const b = buildProblemBody('url_blocked', { detail: 'private IP' });
    expect(b.type).toBe('urn:problem:sct:url_blocked');
    expect(b.title).toBe('URL blocked');
    expect(b.status).toBe(422);
    expect(b.detail).toBe('private IP');
  });

  it('attaches errors and extras', () => {
    const b = buildProblemBody('invalid_input', {
      errors: { fieldErrors: { url: ['invalid'] } },
      extras: { traceId: 'abc' },
    });
    expect(b.errors).toEqual({ fieldErrors: { url: ['invalid'] } });
    expect(b.traceId).toBe('abc');
  });

  it('covers all canonical codes with stable status', () => {
    const codes = [
      ['invalid_input', 400],
      ['unauthorized', 401],
      ['forbidden', 403],
      ['not_found', 404],
      ['conflict', 409],
      ['url_blocked', 422],
      ['rate_limited', 429],
      ['upstream_error', 502],
      ['service_unavailable', 503],
      ['internal_error', 500],
    ] as const;
    for (const [code, status] of codes) {
      expect(buildProblemBody(code).status).toBe(status);
    }
  });
});

describe('problemResponse', () => {
  it('returns application/problem+json with proper status', async () => {
    const res = problemResponse('forbidden', { detail: 'requires editor' });
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as { type: string; status: number; detail?: string };
    expect(body.status).toBe(403);
    expect(body.type).toBe('urn:problem:sct:forbidden');
    expect(body.detail).toBe('requires editor');
  });
});
