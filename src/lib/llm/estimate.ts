import {
  CircuitBreaker,
  CircuitOpenError,
} from '@/lib/server/circuit-breaker';
import { buildEstimationPrompt, PROMPT_VERSION } from './estimation-prompt';
import { ruleBasedEstimate } from './rule-based-fallback';
import { createOpenAiProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import {
  EstimationOutputSchema,
  type EstimationInput,
  type EstimationOutput,
  type EstimationResult,
  type LlmEstimationProvider,
} from './types';

/**
 * spec.md §9.5: LLM 経路の Circuit Breaker. estimate と streamAiChat で共有.
 */
export const llmEstimateCircuit = new CircuitBreaker({
  timeWindowMs: 60_000,
  errorRateThreshold: 0.5,
  openDurationMs: 10_000,
  minCalls: 5,
});

/**
 * estimation オーケストレータ。
 * spec.md §4.1 / §8 / §9.1 LLM provider 全停 → fallback フロー。
 *
 * 1. プロンプト構築 (PII マスキング込み)
 * 2. 主プロバイダ (OpenAI) を呼び出し
 * 3. 失敗時は ルールベース fallback (degraded=true)
 * 4. 出力 JSON を zod 検証 — 失敗時もルールベースに切替
 * 5. confidence < 50 → needsManualReview=true
 *
 * 環境変数:
 *   LLM_PRIMARY_PROVIDER  — "openai" | "fallback" (既定 openai / 未設定で fallback)
 *   OPENAI_API_KEY        — openai 選択時必須 / 不在で fallback
 */

export const CONFIDENCE_REVIEW_THRESHOLD = 50;

export interface EstimateOptions {
  /** 主プロバイダを差し替え (テスト用 / Bedrock 等を将来差し込む) */
  provider?: LlmEstimationProvider;
  signal?: AbortSignal;
  /** テスト用 circuit breaker 差し替え */
  circuit?: CircuitBreaker;
}

function selectProvider(): LlmEstimationProvider | null {
  // 互換: LLM_PROVIDER (typo) も読む
  const choice = (
    process.env.LLM_PRIMARY_PROVIDER ??
    process.env.LLM_PROVIDER ??
    'openai'
  ).toLowerCase();
  if (choice === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return createOpenAiProvider({ apiKey, model: process.env.OPENAI_MODEL });
  }
  if (choice === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return createAnthropicProvider({
      apiKey,
      model: process.env.ANTHROPIC_MODEL,
    });
  }
  // 未対応プロバイダ → fallback (ルールベース)
  return null;
}

function tryParseJson(raw: string): unknown {
  // LLM が ```json ... ``` のように markdown コードフェンスを残した場合の防御
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const candidate = fenced?.[1] ?? raw;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    return undefined;
  }
}

function asResult(
  output: EstimationOutput,
  provider: string,
  degraded: boolean,
): EstimationResult {
  return {
    output,
    degraded,
    needsManualReview: output.confidence < CONFIDENCE_REVIEW_THRESHOLD,
    promptVersion: PROMPT_VERSION,
    provider,
  };
}

export async function estimate(
  input: EstimationInput,
  opts: EstimateOptions = {},
): Promise<EstimationResult> {
  const primary = opts.provider ?? selectProvider();
  // 主プロバイダ不在 → 即時 fallback
  if (!primary) {
    return asResult(ruleBasedEstimate(input), 'rule-based', true);
  }

  const built = buildEstimationPrompt(input);
  const promptText = `${built.system}\n\n${built.user}`;
  const breaker = opts.circuit ?? llmEstimateCircuit;
  try {
    const { rawResponse } = await breaker.exec(() =>
      primary.estimate(promptText, { signal: opts.signal }),
    );
    const parsed = tryParseJson(rawResponse);
    const validated = EstimationOutputSchema.safeParse(parsed);
    if (!validated.success) {
      // 出力スキーマ違反 — ハルシネーションの可能性 → fallback
      return asResult(ruleBasedEstimate(input), `${primary.name}+rule-based`, true);
    }
    return asResult(validated.data, primary.name, false);
  } catch (err) {
    // CircuitOpenError → 外部呼び出しせず即 fallback (provider tag に明示)
    if (err instanceof CircuitOpenError) {
      return asResult(
        ruleBasedEstimate(input),
        `${primary.name}+circuit-open+rule-based`,
        true,
      );
    }
    // タイムアウト / HTTP エラー / ネットワーク失敗 → fallback
    return asResult(ruleBasedEstimate(input), `${primary.name}+rule-based`, true);
  }
}
