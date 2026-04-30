import type { EstimationInput, EstimationOutput, Industry, B2X, CompanySize } from './types';

/**
 * LLM 失敗時 / オフライン時のルールベース fallback (degraded=true で返す)。
 * spec.md §9.1 LLM provider 全停 → フィーチャーフラグで AI Chat 無効化、estimation は本fallbackへ。
 *
 * 設計方針:
 *   - 確実に分類できるキーワードのみ推定 (誤分類を避けるため confidence は低めに)
 *   - キーワード命中なし → industry='unknown' / confidence=0 を返す
 *   - 個人情報/決済も明示キーワード命中時のみ true
 */

interface KeywordRule {
  industry: Industry;
  keywords: RegExp[];
}

// 業界キーワード — 公開サイトでの自社紹介によくある言い回し
const INDUSTRY_RULES: KeywordRule[] = [
  {
    industry: 'medical-saas',
    keywords: [/医療|病院|クリニック|診療|electronic medical record|医療機関/i],
  },
  { industry: 'manufacturing', keywords: [/製造業|製造|工場|加工|manufactur/i] },
  { industry: 'finance', keywords: [/金融|銀行|証券|保険|fintech|payment/i] },
  { industry: 'retail', keywords: [/小売|EC|通販|オンラインショップ|retail|ecommerce/i] },
  {
    industry: 'public-sector',
    keywords: [/官公庁|自治体|公共|行政|government|public sector/i],
  },
  { industry: 'automotive', keywords: [/自動車|モビリティ|automotive|automobile/i] },
  { industry: 'logistics', keywords: [/物流|配送|運送|logistics|shipping/i] },
  { industry: 'education', keywords: [/教育|学校|大学|education|edtech/i] },
  { industry: 'real-estate', keywords: [/不動産|住宅|real estate|property/i] },
  { industry: 'media', keywords: [/メディア|報道|出版|media|publishing/i] },
  {
    industry: 'it-services',
    keywords: [/SaaS|クラウド|システム開発|IT サービス|software/i],
  },
  {
    industry: 'professional-services',
    keywords: [/コンサル|consulting|professional service/i],
  },
  { industry: 'energy', keywords: [/エネルギー|電力|ガス|石油|energy|utility/i] },
  { industry: 'agriculture', keywords: [/農業|農産|水産|agriculture|farming/i] },
];

const PII_KEYWORDS =
  /個人情報|プライバシーポリシー|privacy policy|顧客情報|会員情報|personally identifiable/i;
const PAYMENT_KEYWORDS =
  /決済|クレジットカード|payment|credit card|stripe|paypay|オンライン決済/i;
const SIZE_HINTS_ENTERPRISE = /東証|tokyo stock|nasdaq|連結子会社|fortune 500|enterprise/i;
const SIZE_HINTS_MIDSIZE = /従業員 ?(?:[1-9]\d{2,3}|1\d{4})\s*名|社員数 ?(?:[1-9]\d{2,3})/i;
const B2C_HINTS = /会員登録|マイページ|お買い物|お客様|consumers?/i;
const B2G_HINTS = /官公庁|自治体|公共調達|government clients/i;

function pickIndustry(text: string): { industry: Industry; matched: boolean } {
  for (const rule of INDUSTRY_RULES) {
    if (rule.keywords.some((r) => r.test(text))) {
      return { industry: rule.industry, matched: true };
    }
  }
  return { industry: 'unknown', matched: false };
}

function pickSize(text: string): CompanySize {
  if (SIZE_HINTS_ENTERPRISE.test(text)) return 'enterprise';
  if (SIZE_HINTS_MIDSIZE.test(text)) return 'midsize';
  return 'sme';
}

function pickB2x(text: string): B2X {
  const isC = B2C_HINTS.test(text);
  const isG = B2G_HINTS.test(text);
  if (isC && isG) return 'mixed';
  if (isC) return 'b2c';
  if (isG) return 'b2g';
  return 'b2b';
}

export function ruleBasedEstimate(input: EstimationInput): EstimationOutput {
  const corpus = `${input.title}\n${input.description}\n${input.publicText}`;
  if (corpus.trim().length === 0) {
    return {
      industry: 'unknown',
      size: 'sme',
      b2x: 'b2b',
      handles_personal_info: false,
      handles_payment: false,
      confidence: 0,
      rationale: '抽出テキストが空のため推定不可',
    };
  }
  const { industry, matched } = pickIndustry(corpus);
  const size = pickSize(corpus);
  const b2x = pickB2x(corpus);
  const handles_personal_info = PII_KEYWORDS.test(corpus);
  const handles_payment = PAYMENT_KEYWORDS.test(corpus);
  // ルールベースは LLM より信頼度を低く設定
  const confidence = matched ? 35 : 10;
  const rationale = matched
    ? `キーワードマッチで ${industry} と推定 (ルールベース fallback / confidence 低めに設定)`
    : '業界判定キーワード未検出。手動修正を推奨';
  return {
    industry,
    size,
    b2x,
    handles_personal_info,
    handles_payment,
    confidence,
    rationale: rationale.slice(0, 200),
  };
}
