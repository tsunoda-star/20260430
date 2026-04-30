import { describe, it } from 'vitest';

/**
 * F-06: 障害復旧フロー (LLM プロバイダ全停).
 * flow-test-design.md §7 + spec.md §9.1 に対応。
 *
 * 想定 Step:
 *   1. OPENAI_API_KEY を未設定にして estimate を実行
 *   2. ルールベース fallback が degraded=true で結果を返す
 *   3. Confidence < 50 の場合 needsManualReview=true
 *   4. AI チャット POST /assessment-items/[id]/ai-chat も degraded メッセージ + 参考リンクを返す
 *   5. UI バナー (DegradedBanner 相当) を Wave 4 で追加 — 本シナリオは API 層のみ検証
 *
 * Cycle 5.4 完了時には fail-safe defaults の網羅検証を行う。
 */

describe('F-06: LLM provider outage flow', () => {
  it.todo('estimate falls back to rule-based when OPENAI_API_KEY is unset');
  it.todo('AI chat returns degraded message + 参考 link without API key');
  it.todo('confidence < 50 sets needsManualReview=true');
  it.todo('audit log records provider="rule-based" and degraded=true');
});
