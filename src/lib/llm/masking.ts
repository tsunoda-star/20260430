/**
 * spec.md §8.5 PII / Secret マスキング (LLM 送信前)。
 * パターン検出 → 固定トークンに置換し、LLM コンテキストへの漏洩を防ぐ。
 *
 * 注意:
 *   - フィールド単位除外 (note / evidence_url など) は呼び出し側の責務
 *     (本モジュールは textual masking のみ扱う)
 *   - 過マスキングを避けるため、誤検知の少ないパターンに限定
 */

const PATTERNS: Array<{ name: string; re: RegExp; token: string }> = [
  // AWS Access Key (より特異なものを先に)
  { name: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/g, token: '<aws-key>' },
  // API key / secret / token (汎用)
  {
    name: 'api-key',
    re: /(?<key>(?:api[-_]?key|secret|token))\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi,
    token: '<secret>',
  },
  // クレジットカード (Luhn簡易: 13-19 桁数値、ハイフン/スペース許容)
  { name: 'credit-card', re: /\b(?:\d[ -]?){12,18}\d\b/g, token: '<cc>' },
  // 電話番号 (JP 0XXX-XXXX-XXXX 形式)
  {
    name: 'phone-jp',
    re: /\b0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}\b/g,
    token: '<phone>',
  },
  // メールアドレス
  {
    name: 'email',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    token: '<email>',
  },
];

export interface MaskingResult {
  masked: string;
  hits: Array<{ name: string; count: number }>;
}

export function maskSensitive(input: string): MaskingResult {
  let out = input;
  const hits: Array<{ name: string; count: number }> = [];
  for (const { name, re, token } of PATTERNS) {
    const m = out.match(re);
    if (m && m.length > 0) {
      hits.push({ name, count: m.length });
      out = out.replace(re, token);
    }
  }
  return { masked: out, hits };
}

/**
 * 構造化オブジェクトの string フィールドを再帰的にマスク。
 * テキストフィールドのみ対象 (number/bool/null は素通し)。
 */
export function maskObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return maskSensitive(obj).masked as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => maskObject(v)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = maskObject(v);
    }
    return result as unknown as T;
  }
  return obj;
}
