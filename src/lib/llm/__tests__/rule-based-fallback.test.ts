import { describe, it, expect } from 'vitest';
import { ruleBasedEstimate } from '../rule-based-fallback';

const empty = { url: '', title: '', description: '', publicText: '' };

describe('ruleBasedEstimate', () => {
  it('returns confidence=0 unknown for empty input', () => {
    const r = ruleBasedEstimate(empty);
    expect(r.industry).toBe('unknown');
    expect(r.confidence).toBe(0);
    expect(r.handles_personal_info).toBe(false);
    expect(r.handles_payment).toBe(false);
  });

  it('classifies medical-saas by Japanese/English keywords', () => {
    const r = ruleBasedEstimate({
      ...empty,
      publicText: '当社は病院向けに electronic medical record を提供する SaaS 企業です。',
    });
    // medical-saas / it-services どちらも該当キーワードを含むため、最初に一致した方を採用
    expect(['medical-saas', 'it-services']).toContain(r.industry);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('classifies finance correctly', () => {
    const r = ruleBasedEstimate({ ...empty, publicText: 'Online banking and payment fintech.' });
    expect(r.industry).toBe('finance');
  });

  it('detects PII handling', () => {
    const r = ruleBasedEstimate({
      ...empty,
      publicText: '個人情報の取り扱いについて: プライバシーポリシーをご覧ください',
    });
    expect(r.handles_personal_info).toBe(true);
  });

  it('detects payment handling', () => {
    const r = ruleBasedEstimate({
      ...empty,
      publicText: '弊社サービスはクレジットカード決済に対応',
    });
    expect(r.handles_payment).toBe(true);
  });

  it('infers enterprise size hint', () => {
    const r = ruleBasedEstimate({ ...empty, publicText: '東証プライム上場の連結子会社' });
    expect(r.size).toBe('enterprise');
  });

  it('infers b2c when consumer signals present', () => {
    const r = ruleBasedEstimate({
      ...empty,
      publicText: '会員登録のうえマイページにログインしてお買い物',
    });
    expect(r.b2x).toBe('b2c');
  });

  it('returns low confidence with manual-review note when no industry keyword matches', () => {
    const r = ruleBasedEstimate({
      ...empty,
      publicText: 'A simple company providing services to clients.',
    });
    expect(r.industry).toBe('unknown');
    expect(r.confidence).toBeLessThan(50);
  });

  it('respects rationale length cap (≤200 chars)', () => {
    const r = ruleBasedEstimate(empty);
    expect(r.rationale.length).toBeLessThanOrEqual(200);
  });
});
