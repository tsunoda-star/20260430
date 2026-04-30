import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rerankSuggestions, MAX_CANDIDATES } from '../rerank';
import type { RerankCandidate } from '../rerank';
import type { LlmEstimationProvider } from '../types';

const baseEstimation = {
  industry: 'medical-saas' as const,
  size: 'midsize' as const,
  b2x: 'b2b' as const,
  handles_personal_info: true,
  handles_payment: false,
  rationale: '医療向け SaaS',
};

const candidates: RerankCandidate[] = [
  {
    code: 'IPA-SME',
    name: 'IPA SME',
    category: 'cross',
    isBaseline: true,
    source: 'baseline',
  },
  {
    code: 'MHLW-MEDICAL',
    name: '医療情報システム',
    category: 'medical',
    isBaseline: false,
    source: 'industry-match',
  },
];

function provider(rawResponse: string): LlmEstimationProvider {
  return { name: 'test-llm', estimate: vi.fn(async () => ({ rawResponse })) };
}

describe('rerankSuggestions', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('LLM_PRIMARY_PROVIDER', 'fallback');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns LLM scores when JSON is valid', async () => {
    const r = await rerankSuggestions(baseEstimation, candidates, {
      provider: provider(
        JSON.stringify({
          results: [
            { code: 'IPA-SME', score: 70, rationale: '横断ベースライン' },
            { code: 'MHLW-MEDICAL', score: 95, rationale: '医療向け強推奨' },
          ],
        }),
      ),
    });
    expect(r.degraded).toBe(false);
    expect(r.entries.find((e) => e.code === 'MHLW-MEDICAL')?.score).toBe(95);
    expect(r.entries.find((e) => e.code === 'MHLW-MEDICAL')?.rationale).toContain('医療');
  });

  it('falls back to identity scores on LLM exception', async () => {
    const failing: LlmEstimationProvider = {
      name: 'broken',
      estimate: vi.fn(async () => {
        throw new Error('upstream');
      }),
    };
    const r = await rerankSuggestions(baseEstimation, candidates, { provider: failing });
    expect(r.degraded).toBe(true);
    expect(r.entries.length).toBe(candidates.length);
    // baseline は identity score 70 / industry-match は 50
    expect(r.entries.find((e) => e.code === 'IPA-SME')?.score).toBe(70);
    expect(r.entries.find((e) => e.code === 'MHLW-MEDICAL')?.score).toBe(50);
  });

  it('falls back when LLM JSON does not match schema', async () => {
    const r = await rerankSuggestions(baseEstimation, candidates, {
      provider: provider('{"unexpected":true}'),
    });
    expect(r.degraded).toBe(true);
    expect(r.entries.length).toBe(2);
  });

  it('ignores codes not in input and fills missing ones with identity', async () => {
    const r = await rerankSuggestions(baseEstimation, candidates, {
      provider: provider(
        JSON.stringify({
          results: [
            { code: 'UNKNOWN', score: 99, rationale: 'noise' }, // 無視
            { code: 'IPA-SME', score: 88, rationale: 'OK' }, // 採用
            // MHLW-MEDICAL の評価が抜けている → identity
          ],
        }),
      ),
    });
    expect(r.degraded).toBe(false);
    expect(r.entries.find((e) => e.code === 'IPA-SME')?.score).toBe(88);
    expect(r.entries.find((e) => e.code === 'UNKNOWN')).toBeUndefined();
    const mhlw = r.entries.find((e) => e.code === 'MHLW-MEDICAL');
    expect(mhlw?.rationale).toContain('identity');
  });

  it('handles markdown-fenced JSON', async () => {
    const json = JSON.stringify({
      results: candidates.map((c, i) => ({
        code: c.code,
        score: 60 + i,
        rationale: 'fenced ok',
      })),
    });
    const r = await rerankSuggestions(baseEstimation, candidates, {
      provider: provider(`\`\`\`json\n${json}\n\`\`\``),
    });
    expect(r.degraded).toBe(false);
    expect(r.entries[0]?.rationale).toBe('fenced ok');
  });

  it('returns identity when no provider is selected (no API key)', async () => {
    const r = await rerankSuggestions(baseEstimation, candidates);
    expect(r.degraded).toBe(true);
    expect(r.provider).toBe('identity');
  });

  it('returns empty entries when candidates are empty (no LLM call)', async () => {
    const r = await rerankSuggestions(baseEstimation, []);
    expect(r.entries).toEqual([]);
    expect(r.degraded).toBe(false);
  });

  it('respects MAX_CANDIDATES cap', async () => {
    const many: RerankCandidate[] = Array.from({ length: 50 }, (_, i) => ({
      code: `C${i}`,
      name: `Name ${i}`,
      category: 'cross',
      isBaseline: false,
      source: 'industry-match',
    }));
    const r = await rerankSuggestions(baseEstimation, many, {
      provider: provider(JSON.stringify({ results: [] })),
    });
    expect(r.entries.length).toBeLessThanOrEqual(MAX_CANDIDATES);
  });
});
