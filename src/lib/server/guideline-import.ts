import { z } from 'zod';
import { parse as parseCsv } from 'csv-parse/sync';

/**
 * spec.md §3.2 + Cycle 4.4: ガイドラインマスタの一括 import.
 *
 * 入力フォーマット:
 *   - JSON: GuidelineImportArray (本ファイルの zod schema)
 *   - CSV : code,name,issuer,category,domainTags(|区切り),isBaseline(true/false),sourceUrl
 *
 * 単体テスト容易化のため Prisma 依存ゼロの pure parser に分離。
 * 永続化は呼び出し側 (route handler) の責務。
 */

const GuidelineImportSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(255),
  issuer: z.string().trim().min(1).max(128),
  category: z.string().trim().min(1).max(32),
  domainTags: z.array(z.string().trim().min(1)).max(20).default([]),
  isBaseline: z.boolean().default(false),
  sourceUrl: z.string().url().max(2048).optional().nullable(),
});

export const GuidelineImportArraySchema = z.array(GuidelineImportSchema).min(1).max(500);

export type GuidelineImport = z.infer<typeof GuidelineImportSchema>;

export interface ImportResult {
  records: GuidelineImport[];
  format: 'json' | 'csv';
}

/** CSV 行の domainTags を `|` 区切りで分解、isBaseline は "true"/"1" を真と解釈 */
function csvRowToImport(row: Record<string, string>): unknown {
  const tags = (row['domainTags'] ?? '')
    .split(/[|;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const isBaseline = /^(true|1|yes)$/i.test(row['isBaseline'] ?? '');
  const sourceUrl = (row['sourceUrl'] ?? '').trim();
  return {
    code: row['code'],
    name: row['name'],
    issuer: row['issuer'],
    category: row['category'],
    domainTags: tags,
    isBaseline,
    sourceUrl: sourceUrl.length > 0 ? sourceUrl : undefined,
  };
}

/**
 * テキスト + Content-Type から自動的に JSON / CSV を判別して import データを返す。
 * 大規模 DoS を避けるため textLength は呼び出し側で cap しておくこと (≤ 2MB 推奨)。
 */
export function parseGuidelineImport(text: string, contentType: string): ImportResult {
  const ct = contentType.toLowerCase();
  if (ct.includes('application/json') || /^\s*\[/.test(text)) {
    const json = JSON.parse(text) as unknown;
    const records = GuidelineImportArraySchema.parse(json);
    return { records, format: 'json' };
  }
  // CSV (default fallback)
  const rows = parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;
  const intermediate = rows.map(csvRowToImport);
  const records = GuidelineImportArraySchema.parse(intermediate);
  return { records, format: 'csv' };
}
