/**
 * Prisma seed — 27 ガイドラインマスタ (v1.0 暫定データ).
 * 出典: docs/requirements/requirements.md §22 「適用候補ガイドライン一覧 (マスタv1.0)」
 *
 * Wave 2 で正式な ControlItem (各ガイドラインの対策項目) 投入を行う。
 * ここではマスタ Guideline + GuidelineVersion(v1.0) のみ仮投入する。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GuidelineSeed {
  code: string;
  name: string;
  issuer: string;
  category:
    | 'cross'
    | 'industry'
    | 'government'
    | 'medical'
    | 'finance'
    | 'manufacturing'
    | 'automotive'
    | 'port'
    | 'cloud-procurement';
  domainTags: string[];
  sourceUrl?: string;
  isBaseline?: boolean;
}

/**
 * domainTags にはトピックタグ + Industry slug (LLM の estimation.industry と同名)
 * を併記する。これにより `buildSuggestions` の applies_to 突合が機能する。
 *
 * Industry slugs (src/lib/llm/types.ts industryEnum と同期):
 *   medical-saas / manufacturing / finance / retail / public-sector /
 *   automotive / logistics / education / real-estate / media /
 *   it-services / professional-services / energy / agriculture
 */
const GUIDELINES: GuidelineSeed[] = [
  // 横断 / ベースライン
  {
    code: 'IPA-SME',
    name: '中小企業の情報セキュリティ対策ガイドライン',
    issuer: 'IPA',
    category: 'cross',
    domainTags: ['sme', 'baseline'],
    isBaseline: true,
  },
  {
    code: 'METI-MGMT',
    name: 'サイバーセキュリティ経営ガイドライン',
    issuer: '経済産業省',
    category: 'cross',
    domainTags: ['management', 'baseline'],
    isBaseline: true,
  },
  {
    code: 'NIST-CSF-2',
    name: 'NIST Cybersecurity Framework 2.0',
    issuer: 'NIST',
    category: 'cross',
    domainTags: ['framework', 'international'],
  },
  { code: 'ISO-27001', name: 'ISO/IEC 27001:2022', issuer: 'ISO', category: 'cross', domainTags: ['isms'] },
  { code: 'ISO-27002', name: 'ISO/IEC 27002:2022', issuer: 'ISO', category: 'cross', domainTags: ['isms'] },
  { code: 'CIS-CONTROLS', name: 'CIS Controls v8', issuer: 'CIS', category: 'cross', domainTags: ['controls'] },
  { code: 'OWASP-ASVS', name: 'OWASP ASVS', issuer: 'OWASP', category: 'cross', domainTags: ['app-sec', 'it-services'] },

  // 業界・規制
  { code: 'PCI-DSS-4', name: 'PCI DSS v4.0', issuer: 'PCI SSC', category: 'finance', domainTags: ['payment', 'finance', 'retail'] },
  { code: 'FISC-V11', name: 'FISC 安全対策基準 第11版', issuer: 'FISC', category: 'finance', domainTags: ['banking', 'finance'] },
  {
    code: 'MHLW-MEDICAL',
    name: '医療情報システムの安全管理に関するガイドライン',
    issuer: '厚生労働省',
    category: 'medical',
    domainTags: ['medical', 'personal-info', 'medical-saas'],
  },
  {
    code: 'METI-IOT',
    name: 'IoTセキュリティガイドライン',
    issuer: '経済産業省',
    category: 'manufacturing',
    domainTags: ['iot', 'manufacturing', 'automotive'],
  },
  {
    code: 'METI-AUTO',
    name: '自動車産業サイバーセキュリティガイドライン',
    issuer: '経済産業省',
    category: 'automotive',
    domainTags: ['automotive', 'supply-chain'],
  },
  {
    code: 'PORT-CYBER',
    name: '港湾サイバーセキュリティガイドライン',
    issuer: '国土交通省',
    category: 'port',
    domainTags: ['critical-infra', 'port', 'logistics'],
  },
  {
    code: 'MIC-CLOUD-PROC',
    name: '政府機関等のクラウドサービス調達に関するガイドライン',
    issuer: '総務省',
    category: 'cloud-procurement',
    domainTags: ['government', 'procurement', 'public-sector', 'it-services'],
  },

  // 政府 / 公共
  {
    code: 'NISC-GOV',
    name: '政府機関等のサイバーセキュリティ対策のための統一基準',
    issuer: 'NISC',
    category: 'government',
    domainTags: ['government', 'public-sector'],
  },
  { code: 'ISMAP', name: 'ISMAP 管理基準', issuer: 'ISMAP', category: 'cloud-procurement', domainTags: ['cloud', 'gov', 'public-sector', 'it-services'] },

  // 業界別 (cross / industry)
  { code: 'TELECOM-MIC', name: '電気通信事業者の情報セキュリティ対策', issuer: '総務省', category: 'industry', domainTags: ['telecom', 'media', 'it-services'] },
  { code: 'BCP-CABINET', name: '事業継続ガイドライン', issuer: '内閣府', category: 'cross', domainTags: ['bcp'] },
  { code: 'PRIVACY-PPC', name: '個人情報の保護に関する法律ガイドライン', issuer: '個人情報保護委員会', category: 'cross', domainTags: ['privacy'] },
  { code: 'JISQ-15001', name: 'JIS Q 15001:2023 (PMS)', issuer: 'JIS', category: 'cross', domainTags: ['privacy'] },

  // SaaS / Web 系
  { code: 'OWASP-TOP10', name: 'OWASP Top 10 (Web)', issuer: 'OWASP', category: 'cross', domainTags: ['web', 'it-services', 'retail', 'media'] },
  { code: 'OWASP-API-TOP10', name: 'OWASP API Security Top 10', issuer: 'OWASP', category: 'cross', domainTags: ['api', 'it-services'] },
  { code: 'CSA-CCM', name: 'CSA Cloud Controls Matrix', issuer: 'CSA', category: 'cross', domainTags: ['cloud', 'it-services'] },

  // 製造 / 重要インフラ
  { code: 'IEC-62443', name: 'IEC 62443 (OT セキュリティ)', issuer: 'IEC', category: 'manufacturing', domainTags: ['ot', 'industrial', 'manufacturing', 'energy'] },
  { code: 'NIST-800-171', name: 'NIST SP 800-171', issuer: 'NIST', category: 'cross', domainTags: ['cui', 'supply-chain', 'manufacturing', 'public-sector'] },
  { code: 'METI-SUPPLY', name: 'サプライチェーンサイバーセキュリティ', issuer: '経済産業省', category: 'cross', domainTags: ['supply-chain', 'manufacturing', 'automotive'] },
  {
    code: 'JPCERT-INCIDENT',
    name: 'インシデント対応ガイド',
    issuer: 'JPCERT/CC',
    category: 'cross',
    domainTags: ['incident'],
  },
];

async function main(): Promise<void> {
  if (GUIDELINES.length !== 27) {
    throw new Error(`Expected exactly 27 guidelines, got ${GUIDELINES.length}`);
  }

  const releasedAt = new Date('2026-04-01T00:00:00Z');

  for (const g of GUIDELINES) {
    const guideline = await prisma.guideline.upsert({
      where: { code: g.code },
      update: {
        name: g.name,
        issuer: g.issuer,
        category: g.category,
        domainTags: g.domainTags,
        sourceUrl: g.sourceUrl ?? null,
        isBaseline: g.isBaseline ?? false,
        isActive: true,
      },
      create: {
        code: g.code,
        name: g.name,
        issuer: g.issuer,
        category: g.category,
        domainTags: g.domainTags,
        sourceUrl: g.sourceUrl ?? null,
        isBaseline: g.isBaseline ?? false,
        isActive: true,
      },
    });

    await prisma.guidelineVersion.upsert({
      where: { guidelineId_version: { guidelineId: guideline.id, version: 'v1.0' } },
      update: {
        schemaHash: hashHexAsciiOnly(`${g.code}|v1.0`),
        releasedAt,
        changelog: 'Initial seed (Wave 1).',
      },
      create: {
        guidelineId: guideline.id,
        version: 'v1.0',
        schemaHash: hashHexAsciiOnly(`${g.code}|v1.0`),
        releasedAt,
        changelog: 'Initial seed (Wave 1).',
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${GUIDELINES.length} guidelines (v1.0).`);
}

/** decided: deterministic 64-char hex from input — actual SHA-256 will be applied in Wave 2 */
function hashHexAsciiOnly(input: string): string {
  let h = 0n;
  for (let i = 0; i < input.length; i++) {
    h = (h * 1099511628211n + BigInt(input.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0').repeat(4);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
