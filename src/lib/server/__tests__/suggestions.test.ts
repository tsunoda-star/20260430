import { describe, it, expect } from 'vitest';
import { buildSuggestions, type GuidelineLite } from '../suggestions';

const G = (overrides: Partial<GuidelineLite>): GuidelineLite => ({
  id: 1,
  code: 'X',
  name: 'name',
  category: 'governance',
  domainTags: [],
  isBaseline: false,
  appliesTo: [],
  priorityScore: 0,
  ...overrides,
});

describe('buildSuggestions', () => {
  it('groups baseline first regardless of industry', () => {
    const guidelines = [
      G({ code: 'IPA-SME', isBaseline: true, name: 'IPA SME' }),
      G({ code: 'METI-MGMT', isBaseline: true, name: 'METI Management' }),
    ];
    const r = buildSuggestions({
      guidelines,
      estimation: { industry: 'manufacturing' },
    });
    expect(r.baseline.map((e) => e.guideline.code).sort()).toEqual(['IPA-SME', 'METI-MGMT']);
    expect(r.industryMatch).toEqual([]);
  });

  it('matches industry via appliesTo', () => {
    const guidelines = [
      G({ code: 'MED-1', appliesTo: ['medical-saas'], name: 'Medical SaaS Guide' }),
      G({ code: 'MFG-1', appliesTo: ['manufacturing'], name: 'Mfg Guide' }),
    ];
    const r = buildSuggestions({
      guidelines,
      estimation: { industry: 'medical-saas' },
    });
    expect(r.industryMatch.map((e) => e.guideline.code)).toEqual(['MED-1']);
    expect(r.baseline).toEqual([]);
  });

  it('skips already-selected codes', () => {
    const guidelines = [
      G({ code: 'B1', isBaseline: true, name: 'Baseline 1' }),
      G({ code: 'B2', isBaseline: true, name: 'Baseline 2' }),
    ];
    const r = buildSuggestions({
      guidelines,
      estimation: { industry: 'finance' },
      alreadySelectedCodes: new Set(['B2']),
    });
    expect(r.baseline.map((e) => e.guideline.code)).toEqual(['B1']);
  });

  it('sorts within group by priorityScore desc, then name', () => {
    const guidelines = [
      G({ code: 'A', isBaseline: true, name: 'Alpha', priorityScore: 0 }),
      G({ code: 'B', isBaseline: true, name: 'Bravo', priorityScore: 10 }),
      G({ code: 'C', isBaseline: true, name: 'Charlie', priorityScore: 0 }),
    ];
    const r = buildSuggestions({
      guidelines,
      estimation: { industry: 'manufacturing' },
    });
    // Bravo (priority 10) → Alpha (0, name先) → Charlie (0)
    expect(r.baseline.map((e) => e.guideline.code)).toEqual(['B', 'A', 'C']);
  });

  it('emits rationale string for each entry', () => {
    const r = buildSuggestions({
      guidelines: [G({ code: 'AUTO-1', appliesTo: ['automotive'] })],
      estimation: { industry: 'automotive' },
    });
    expect(r.industryMatch[0]?.rationale).toContain('automotive');
  });

  it('returns empty when no guidelines match and none baseline', () => {
    const r = buildSuggestions({
      guidelines: [G({ code: 'X', appliesTo: ['retail'] })],
      estimation: { industry: 'manufacturing' },
    });
    expect(r.baseline).toEqual([]);
    expect(r.industryMatch).toEqual([]);
  });
});
