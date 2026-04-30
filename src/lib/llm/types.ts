import { z } from 'zod';

/**
 * spec.md §8.2 estimation 出力スキーマ。
 * LLM の生レスポンスを zod で検証してから業務ロジックに渡す。
 */
export const industryEnum = z.enum([
  'medical-saas',
  'manufacturing',
  'finance',
  'retail',
  'public-sector',
  'automotive',
  'logistics',
  'education',
  'real-estate',
  'media',
  'it-services',
  'professional-services',
  'energy',
  'agriculture',
  'unknown',
]);

export const sizeEnum = z.enum(['sme', 'midsize', 'enterprise']);
export const b2xEnum = z.enum(['b2b', 'b2c', 'b2g', 'mixed']);

export const EstimationOutputSchema = z.object({
  industry: industryEnum,
  size: sizeEnum,
  b2x: b2xEnum,
  handles_personal_info: z.boolean(),
  handles_payment: z.boolean(),
  confidence: z.number().int().min(0).max(100),
  rationale: z.string().max(200),
});

export type EstimationOutput = z.infer<typeof EstimationOutputSchema>;
export type Industry = z.infer<typeof industryEnum>;
export type CompanySize = z.infer<typeof sizeEnum>;
export type B2X = z.infer<typeof b2xEnum>;

export interface EstimationInput {
  url: string;
  title: string;
  description: string;
  /** 抽出済み公開テキスト (PII マスキング前) — 12kB 上限想定 */
  publicText: string;
}

export interface EstimationResult {
  output: EstimationOutput;
  /** ルールベース fallback で返したか (LLM 失敗時 true) */
  degraded: boolean;
  /** confidence < 50 で UI に「自動修正推奨」バッジを出すフラグ */
  needsManualReview: boolean;
  /** プロンプトバージョン (Phase 6 月次評価用) */
  promptVersion: string;
  /** 使用したプロバイダ名 */
  provider: string;
}

/**
 * spec.md §8 LLM Provider 抽象化。
 * - OpenAI Enterprise (data opt-out)
 * - Bedrock (enable_logging=false)
 * - rule-based fallback (オフライン)
 */
export interface LlmEstimationProvider {
  name: string;
  estimate: (
    prompt: string,
    options?: { signal?: AbortSignal },
  ) => Promise<{ rawResponse: string }>;
}
