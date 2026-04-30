import type { EstimationOutput } from '@/lib/llm';

/**
 * spec.md §4.1 ガイドライン候補ロジック。
 *
 * Cycle 2.4 (本コミット): 確実な部分のみ実装
 *   - is_baseline=true のものは常に baseline グループに含める
 *   - applies_to に推定 industry が含まれるものを candidate グループに含める
 *   - 各グループ内で priority(High→Low) → name で安定ソート
 *
 * Cycle 2.5 (LLM-rank): rationale 付きで再ランキング、is_excluded をマスタからも提案
 */

export interface GuidelineLite {
  id: bigint | number;
  code: string;
  name: string;
  category: string;
  domainTags: string[];
  isBaseline: boolean;
  /**
   * 当該ガイドラインの applies_to 集合 (control_items.applies_to を集約 or
   * guidelines.domain_tags をプロキシとして使用可能)。
   * Cycle 2.4 では domainTags を採用。
   */
  appliesTo: string[];
  /** 並び替え用 (大きいほど優先) */
  priorityScore?: number;
}

export interface SuggestionEntry {
  guideline: GuidelineLite;
  /** "baseline" | "industry-match" | "manual" */
  source: SuggestionSource;
  /** マッチ理由の簡易説明 (UI 表示) */
  rationale: string;
}

export type SuggestionSource = 'baseline' | 'industry-match' | 'manual';

export interface BuildSuggestionsInput {
  guidelines: GuidelineLite[];
  estimation: Pick<EstimationOutput, 'industry'>;
  /** 既に選択済み (前回 assessment 等) の guideline.code 一覧。重複を除外する。 */
  alreadySelectedCodes?: ReadonlySet<string>;
}

export interface SuggestionGroups {
  baseline: SuggestionEntry[];
  industryMatch: SuggestionEntry[];
}

function compareEntries(a: SuggestionEntry, b: SuggestionEntry): number {
  const pa = a.guideline.priorityScore ?? 0;
  const pb = b.guideline.priorityScore ?? 0;
  if (pa !== pb) return pb - pa;
  return a.guideline.name.localeCompare(b.guideline.name, 'ja');
}

export function buildSuggestions(input: BuildSuggestionsInput): SuggestionGroups {
  const skip = input.alreadySelectedCodes ?? new Set<string>();
  const baseline: SuggestionEntry[] = [];
  const industryMatch: SuggestionEntry[] = [];
  const seen = new Set<string>();

  for (const g of input.guidelines) {
    if (skip.has(g.code) || seen.has(g.code)) continue;
    if (g.isBaseline) {
      baseline.push({
        guideline: g,
        source: 'baseline',
        rationale: '横断ベースライン (全業種で必須)',
      });
      seen.add(g.code);
      continue;
    }
    if (g.appliesTo.includes(input.estimation.industry)) {
      industryMatch.push({
        guideline: g,
        source: 'industry-match',
        rationale: `業界 (${input.estimation.industry}) に該当`,
      });
      seen.add(g.code);
    }
  }
  baseline.sort(compareEntries);
  industryMatch.sort(compareEntries);
  return { baseline, industryMatch };
}
