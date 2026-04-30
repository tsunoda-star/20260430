import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { estimate, CONFIDENCE_REVIEW_THRESHOLD } from '../estimate';
import { CircuitBreaker } from '@/lib/server/circuit-breaker';
import type { EstimationInput, LlmEstimationProvider } from '../types';

const baseInput: EstimationInput = {
  url: 'https://acme.example',
  title: 'Acme — Medical SaaS',
  description: '医療機関向け電子カルテ',
  publicText: '弊社は病院向けに electronic medical record を提供しています。',
};

function makeProvider(rawResponse: string, name = 'test-llm'): LlmEstimationProvider {
  return { name, estimate: vi.fn(async () => ({ rawResponse })) };
}

describe('estimate orchestrator', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('LLM_PRIMARY_PROVIDER', 'fallback');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns LLM result on valid JSON response', async () => {
    const provider = makeProvider(
      JSON.stringify({
        industry: 'medical-saas',
        size: 'midsize',
        b2x: 'b2b',
        handles_personal_info: true,
        handles_payment: false,
        confidence: 80,
        rationale: '医療向け SaaS',
      }),
    );
    const r = await estimate(baseInput, { provider });
    expect(r.degraded).toBe(false);
    expect(r.output.industry).toBe('medical-saas');
    expect(r.output.confidence).toBe(80);
    expect(r.needsManualReview).toBe(false);
    expect(r.provider).toBe('test-llm');
  });

  it('flags needsManualReview when confidence < threshold', async () => {
    const provider = makeProvider(
      JSON.stringify({
        industry: 'manufacturing',
        size: 'sme',
        b2x: 'b2b',
        handles_personal_info: false,
        handles_payment: false,
        confidence: CONFIDENCE_REVIEW_THRESHOLD - 1,
        rationale: '低確信',
      }),
    );
    const r = await estimate(baseInput, { provider });
    expect(r.needsManualReview).toBe(true);
    expect(r.degraded).toBe(false);
  });

  it('falls back to rule-based on LLM exception', async () => {
    const failing: LlmEstimationProvider = {
      name: 'broken',
      estimate: vi.fn(async () => {
        throw new Error('upstream timeout');
      }),
    };
    const r = await estimate(baseInput, { provider: failing });
    expect(r.degraded).toBe(true);
    expect(r.provider).toContain('rule-based');
  });

  it('falls back when LLM returns invalid JSON', async () => {
    const provider = makeProvider('this is not json');
    const r = await estimate(baseInput, { provider });
    expect(r.degraded).toBe(true);
    expect(r.provider).toContain('rule-based');
  });

  it('falls back when LLM returns schema-violating JSON', async () => {
    const provider = makeProvider(JSON.stringify({ industry: 'unknown-banana', size: 'huge' }));
    const r = await estimate(baseInput, { provider });
    expect(r.degraded).toBe(true);
  });

  it('handles markdown-fenced JSON output (defensive)', async () => {
    const provider = makeProvider(
      [
        '```json',
        JSON.stringify({
          industry: 'finance',
          size: 'enterprise',
          b2x: 'b2b',
          handles_personal_info: true,
          handles_payment: true,
          confidence: 70,
          rationale: '金融',
        }),
        '```',
      ].join('\n'),
    );
    const r = await estimate(baseInput, { provider });
    expect(r.degraded).toBe(false);
    expect(r.output.industry).toBe('finance');
  });

  it('uses pure rule-based fallback when no provider is selected (no API key)', async () => {
    const r = await estimate(baseInput); // no provider given, env unset
    expect(r.degraded).toBe(true);
    expect(r.provider).toBe('rule-based');
  });

  it('skips LLM call when circuit breaker is open (degraded fast-fail)', async () => {
    // Pre-trip the breaker so its initial state is open
    const circuit = new CircuitBreaker({
      minCalls: 1,
      errorRateThreshold: 1,
      openDurationMs: 60_000,
    });
    circuit.recordFailure();
    expect(circuit.getState()).toBe('open');

    const provider: LlmEstimationProvider = {
      name: 'test-llm',
      estimate: vi.fn(async () => ({ rawResponse: '{}' })),
    };
    const r = await estimate(baseInput, { provider, circuit });
    expect(r.degraded).toBe(true);
    expect(r.provider).toContain('circuit-open');
    expect(provider.estimate).not.toHaveBeenCalled();
  });
});
