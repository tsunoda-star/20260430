/**
 * Seed: 各ガイドラインに代表的なチェック項目を投入する。
 *
 * Wave 2 で予定されていた正式な ControlItem 投入の暫定版 (デモ用)。
 * 本格的な内容は各ガイドライン本文から抽出する必要があるが、
 * ここでは横断的に意味のある共通項目 + ガイドライン固有の代表項目を入れる。
 *
 * 実行: DATABASE_URL=... tsx prisma/seed-control-items.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ControlSeed {
  category: string;
  subCategory?: string;
  controlCode?: string;
  title: string;
  description: string;
  priority: number; // 0-100
  normalizedKey: string;
}

// 全ガイドライン共通で適用するベース 14 項目 (横断的セキュリティ管理)
const COMMON_CONTROLS: ControlSeed[] = [
  {
    category: 'ガバナンス',
    title: '情報セキュリティ方針を文書化し経営層が承認している',
    description:
      '組織の情報セキュリティ方針 (Information Security Policy) を文書化し、経営層 (代表取締役・CISO 等) が正式に承認・公開している。最低でも年1回見直す。',
    priority: 95,
    normalizedKey: 'governance.policy',
  },
  {
    category: 'ガバナンス',
    title: '責任者 (CISO 等) を任命している',
    description:
      'セキュリティ全般の責任者を明確に任命し、経営会議への報告ラインを確保している。',
    priority: 80,
    normalizedKey: 'governance.role',
  },
  {
    category: 'リスク管理',
    title: 'リスクアセスメントを定期的に実施している',
    description:
      '保有資産・脅威・脆弱性を整理し、年1回以上のリスクアセスメントを実施。リスクごとに低減策を計画する。',
    priority: 85,
    normalizedKey: 'risk.assessment',
  },
  {
    category: 'アクセス制御',
    title: '最小権限の原則でアクセスを付与している',
    description:
      '従業員・委託先には業務に必要な最小限のシステム/データへのアクセス権のみ付与する。退職・異動時に即時取消する。',
    priority: 90,
    normalizedKey: 'access.least-privilege',
  },
  {
    category: 'アクセス制御',
    title: '管理者アカウントに多要素認証 (MFA) を必須化している',
    description:
      'クラウド管理コンソール / VPN / メール / SSO 等の管理者アカウントには MFA を必須化する。',
    priority: 95,
    normalizedKey: 'access.mfa',
  },
  {
    category: 'パスワード',
    title: 'パスワードポリシーを定め周知している',
    description:
      '12 文字以上・複雑性・使い回し禁止・パスワードマネージャ推奨等のポリシーを定め、全従業員に周知する。',
    priority: 70,
    normalizedKey: 'password.policy',
  },
  {
    category: 'マルウェア対策',
    title: '全エンドポイントに EDR / アンチウイルスを導入している',
    description:
      '従業員端末・サーバに EDR (もしくはアンチウイルス) を導入し、定義ファイル/エンジンを自動更新する。',
    priority: 85,
    normalizedKey: 'malware.edr',
  },
  {
    category: '脆弱性管理',
    title: 'OS / ソフトウェアにパッチを適用している',
    description:
      'OS・ミドルウェア・ライブラリに対し、重大な脆弱性公表から 30 日以内にパッチを適用する仕組みを構築する。',
    priority: 85,
    normalizedKey: 'vuln.patch',
  },
  {
    category: 'データ保護',
    title: '個人情報・機密情報を暗号化している',
    description:
      'データベース・ストレージ・バックアップで個人情報や機密情報を暗号化 (AES-256 等) している。鍵は KMS で管理する。',
    priority: 90,
    normalizedKey: 'data.encryption',
  },
  {
    category: 'データ保護',
    title: 'バックアップを取得し定期的にリストア試験を行う',
    description:
      '重要データのバックアップを 3-2-1 ルール (3 コピー / 2 メディア / 1 オフサイト) で取得し、年1回以上のリストア試験を実施する。',
    priority: 80,
    normalizedKey: 'data.backup',
  },
  {
    category: 'インシデント対応',
    title: 'インシデント対応手順を文書化し訓練している',
    description:
      'セキュリティインシデント発生時の連絡網・初動・封じ込め・根絶・復旧・事後レビューの手順を文書化し、年1回の机上訓練を行う。',
    priority: 80,
    normalizedKey: 'incident.runbook',
  },
  {
    category: 'インシデント対応',
    title: '個人情報漏えい時の通知体制を整えている',
    description:
      '個人情報保護法・GDPR 等に基づく漏えい時の本人通知 / 当局報告のフローを整備し、72 時間以内の対応を可能にする。',
    priority: 70,
    normalizedKey: 'incident.breach-notice',
  },
  {
    category: '従業員教育',
    title: '全従業員にセキュリティ教育を年1回実施している',
    description:
      'フィッシング・パスワード・情報持ち出し等の基礎教育を年1回以上、全従業員 (役員・派遣含む) に実施する。',
    priority: 65,
    normalizedKey: 'training.annual',
  },
  {
    category: '物理セキュリティ',
    title: 'オフィス・サーバルームの入退室を制御している',
    description:
      'IC カード等で重要エリアの入退室を記録し、退職者のカードは即時失効する。',
    priority: 60,
    normalizedKey: 'physical.access',
  },
];

// ガイドライン固有の追加項目
const SPECIFIC_CONTROLS: Record<string, ControlSeed[]> = {
  'IPA-SME': [
    {
      category: 'クラウド利用',
      title: 'クラウドサービス利用時のシャドウIT を把握している',
      description:
        '従業員が業務利用しているクラウドサービスを棚卸し、無断契約 (シャドウ IT) を検知・統制する。',
      priority: 60,
      normalizedKey: 'cloud.shadow-it',
    },
  ],
  'METI-MGMT': [
    {
      category: 'サプライチェーン',
      title: '取引先のセキュリティ水準を契約・チェックリストで確認',
      description:
        '委託先 / SaaS ベンダ / 取引先のセキュリティ水準を、契約条項とチェックリストで定期的に確認する。',
      priority: 70,
      normalizedKey: 'supply.partner',
    },
    {
      category: 'ガバナンス',
      title: '取締役会にセキュリティ KPI を報告',
      description:
        '取締役会または経営会議でインシデント数・パッチ適用率等の KPI を四半期で報告する。',
      priority: 65,
      normalizedKey: 'governance.kpi',
    },
  ],
  'OWASP-TOP10': [
    {
      category: 'Webアプリ',
      title: 'SQL インジェクション対策 (Parameterized Query)',
      description:
        '全 SQL 実行箇所でプリペアドステートメント / ORM のパラメタライズドクエリを利用し、文字列連結を禁止する。',
      priority: 90,
      normalizedKey: 'web.sqli',
    },
    {
      category: 'Webアプリ',
      title: '認証・セッション管理の脆弱性対策',
      description:
        'セッション固定攻撃・Cookie の Secure/HttpOnly/SameSite・パスワードハッシュ (Argon2 等) を実装する。',
      priority: 90,
      normalizedKey: 'web.authn',
    },
    {
      category: 'Webアプリ',
      title: 'XSS 対策 (CSP + 出力エスケープ)',
      description:
        'Content-Security-Policy ヘッダの設定とテンプレートエンジンによる自動エスケープを徹底する。',
      priority: 85,
      normalizedKey: 'web.xss',
    },
  ],
  'OWASP-API-TOP10': [
    {
      category: 'API',
      title: 'API 認可 (Object Level Authorization) の実装',
      description:
        'API リソース単位での認可チェックを実装し、URL の id を差し替えるだけで他テナントのデータにアクセスできないようにする。',
      priority: 90,
      normalizedKey: 'api.bola',
    },
    {
      category: 'API',
      title: 'API レート制限の実装',
      description:
        'API のエンドポイントごとに IP / API キー / ユーザー単位でレート制限を実装する。',
      priority: 70,
      normalizedKey: 'api.ratelimit',
    },
  ],
  'PRIVACY-PPC': [
    {
      category: '個人情報',
      title: '利用目的を明示し本人同意を取得',
      description:
        '個人情報の取得時に利用目的を明示し、本人の明示的同意を取得・記録する。',
      priority: 80,
      normalizedKey: 'privacy.consent',
    },
    {
      category: '個人情報',
      title: '保有個人データの開示・訂正・削除請求対応',
      description:
        '本人からの開示・訂正・利用停止・削除請求に対応するフローを整備し、社内窓口を公表する。',
      priority: 70,
      normalizedKey: 'privacy.dsar',
    },
  ],
  'PCI-DSS-4': [
    {
      category: 'カード情報',
      title: 'カード情報の保存最小化 (PAN マスク)',
      description:
        'カード番号 (PAN) は原則保存せず、保存時はトークン化または暗号化 + マスク表示する。',
      priority: 95,
      normalizedKey: 'pci.pan',
    },
    {
      category: 'ネットワーク',
      title: 'カード処理セグメントのネットワーク分離',
      description:
        'CDE (Cardholder Data Environment) を他のネットワークから分離し、ファイアウォールで通信を最小化する。',
      priority: 85,
      normalizedKey: 'pci.segmentation',
    },
  ],
  'NIST-CSF-2': [
    {
      category: 'NIST CSF',
      title: 'Identify: 資産インベントリの整備',
      description:
        'ハードウェア・ソフトウェア・データ・サービスを棚卸しし、所有者と機密性レベルを記録する。',
      priority: 80,
      normalizedKey: 'nist.identify',
    },
    {
      category: 'NIST CSF',
      title: 'Detect: ログ収集と監視',
      description:
        'システム・アプリケーション・ネットワークのログを集約し、SIEM/SOC で異常検知を運用する。',
      priority: 75,
      normalizedKey: 'nist.detect',
    },
  ],
};

async function main(): Promise<void> {
  const versions = await prisma.guidelineVersion.findMany({
    select: {
      id: true,
      guideline: { select: { id: true, code: true } },
    },
  });

  let totalInserted = 0;
  for (const v of versions) {
    const code = v.guideline.code;
    const specific = SPECIFIC_CONTROLS[code] ?? [];
    const all = [...COMMON_CONTROLS, ...specific];

    // 既存項目を全て削除して入れ直す (idempotent)
    await prisma.controlItem.deleteMany({ where: { guidelineVersionId: v.id } });

    for (const c of all) {
      await prisma.controlItem.create({
        data: {
          guidelineVersionId: v.id,
          category: c.category,
          subCategory: c.subCategory ?? null,
          controlCode: c.controlCode ?? null,
          title: c.title,
          description: c.description,
          priority: c.priority,
          appliesTo: [],
          normalizedKey: c.normalizedKey,
          sourceExcerpt: null,
          references: undefined,
        },
      });
      totalInserted += 1;
    }
    // eslint-disable-next-line no-console
    console.log(`[${code}] ${all.length} controls`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nDone. ${totalInserted} ControlItem rows inserted across ${versions.length} versions.`);
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
