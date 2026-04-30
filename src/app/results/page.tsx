import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/server/db';
import { resolveTenantContext } from '@/lib/server/tenant';
import { isDevAuthBypassEnabled, devSessionUser } from '@/lib/auth/dev-bypass';
import { SESSION_COOKIE_NAME, verifyIdToken, type SessionUser } from '@/lib/auth/session';
import { CompanyFavicon } from '@/components/company-favicon';
import { CompanyProfileCard } from '@/components/company-profile-card';
import { CreateAssessmentSection } from '@/components/create-assessment-section';
import { ResultsUrlBar } from '@/components/results-url-bar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * /results?url=... — URL ベースのパーマリンクで分析結果を表示する。
 * 同じ URL を投入すると常に同じ画面に着くので共有しやすい。
 *
 * - ?url= から domain を抽出 → tenant スコープで Company を検索
 * - 未分析の場合は空の状態を表示し、トップへの誘導を出す
 */

async function getSession(): Promise<SessionUser | null> {
  if (isDevAuthBypassEnabled()) return devSessionUser();
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifyIdToken(token);
  } catch {
    return null;
  }
}

const INDUSTRY_LABEL: Record<string, string> = {
  media: 'メディア・出版',
  finance: '金融',
  retail: 'EC・小売',
  manufacturing: '製造業',
  'medical-saas': '医療・SaaS',
  education: '教育',
  'public-sector': '公共・自治体',
  logistics: '物流・運輸',
  'real-estate': '不動産',
  automotive: '自動車',
  'it-services': 'IT・ソフトウェア',
  energy: 'エネルギー',
  agriculture: '農業',
  'professional-services': 'コンサル・専門サービス',
  unknown: '不明',
};

const SIZE_LABEL: Record<string, string> = {
  sme: '中小企業',
  midsize: '中堅',
  enterprise: '大手',
  startup: 'スタートアップ',
  mid: '中堅',
  unknown: '不明',
};

const B2X_LABEL: Record<string, string> = {
  b2b: 'B2B',
  b2c: 'B2C',
  b2g: 'B2G',
  mixed: 'B2B/B2C',
};

const PHASE_LABEL: Record<string, string> = {
  startup: '創業期',
  sme: '成長期',
  mid: '成熟期',
  midsize: '成熟期',
  enterprise: '拡大期',
  unknown: '不明',
};

interface InferredData {
  industry?: string;
  size?: string;
  b2x?: string;
  rationale?: string;
  reasoning?: string;
  evidence?: string[];
  crawl?: {
    title?: string;
    description?: string;
    snippet?: string;
    finalUrl?: string;
    fetchedAt?: string;
  };
  confirmedAt?: string;
}

function safeUrl(input: string | undefined | null): URL | null {
  if (!input) return null;
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u;
  } catch {
    return null;
  }
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: { url?: string };
}): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  const submittedUrl = searchParams.url ?? '';
  const parsed = safeUrl(submittedUrl);
  if (!parsed) {
    return <NotAnalyzed url={submittedUrl} reason="invalid_url" />;
  }
  const domain = parsed.hostname.toLowerCase();

  const { tenantId } = await resolveTenantContext(session);
  const company = await prisma.company.findFirst({
    where: { tenantId, domain },
    select: {
      id: true,
      domain: true,
      displayName: true,
      industry: true,
      size: true,
      inferredData: true,
      inferenceConfidence: true,
      createdAt: true,
      assessments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, createdAt: true },
      },
    },
  });

  if (!company) {
    return <NotAnalyzed url={parsed.toString()} reason="not_found" />;
  }

  const inferred = (company.inferredData ?? {}) as InferredData;
  const description = inferred.crawl?.description ?? null;
  const reasoning = inferred.rationale ?? inferred.reasoning ?? null;
  const confidencePct = Math.max(0, Math.min(100, company.inferenceConfidence ?? 0));
  const displayName = company.displayName ?? company.domain;
  const industryKey = company.industry ?? 'unknown';
  const sizeKey = company.size ?? 'unknown';
  const b2xKey = inferred.b2x ?? 'b2b';
  const finalUrl = inferred.crawl?.finalUrl ?? parsed.toString();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <ResultsUrlBar url={finalUrl} fetchedAt={inferred.crawl?.fetchedAt ?? null} />

      <article className="mt-6 overflow-hidden rounded-2xl border bg-background shadow-sm">
        <header className="flex items-start gap-5 p-6 md:p-8">
          <CompanyFavicon domain={company.domain} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight md:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {company.domain}
            </p>
            {description ? (
              <p className="mt-4 text-sm leading-relaxed text-foreground/80 line-clamp-4">
                {description}
              </p>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-px border-t bg-border md:grid-cols-3">
          <Field
            icon="📊"
            label="ビジネスモデル"
            value={B2X_LABEL[b2xKey] ?? b2xKey.toUpperCase()}
          />
          <Field
            icon="📈"
            label="プロダクトのフェーズ"
            value={PHASE_LABEL[sizeKey] ?? sizeKey}
          />
          <Field
            icon="🏷"
            label="業界・ドメイン"
            value={INDUSTRY_LABEL[industryKey] ?? industryKey}
          />
        </div>
      </article>

      <section className="mt-8">
        <CompanyProfileCard
          companyId={company.id.toString()}
          initialDisplayName={displayName}
          initialIndustry={company.industry}
          initialSize={company.size}
          confidencePct={confidencePct}
          reasoning={reasoning}
        />
      </section>

      <div className="mt-8">
        <CreateAssessmentSection
          companyId={company.id.toString()}
          companyDisplayName={displayName}
        />
      </div>

      {company.assessments.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            過去のチェックシート
          </h2>
          <ul className="divide-y rounded-xl border">
            {company.assessments.map((a) => (
              <li key={a.id.toString()}>
                <Link
                  href={`/app/assessments/${a.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString('ja-JP')} ・ {a.status}
                    </p>
                  </div>
                  <span aria-hidden className="text-muted-foreground">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="bg-background px-6 py-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span aria-hidden className="text-base">
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-heading text-lg font-semibold leading-tight">
        {value}
      </p>
    </div>
  );
}

function NotAnalyzed({
  url,
  reason,
}: {
  url: string;
  reason: 'invalid_url' | 'not_found';
}): JSX.Element {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center md:py-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        {reason === 'invalid_url' ? 'INVALID URL' : 'NOT ANALYZED YET'}
      </p>
      <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight">
        {reason === 'invalid_url'
          ? 'URL の形式が正しくありません'
          : 'この URL はまだ分析されていません'}
      </h1>
      {url && reason === 'not_found' ? (
        <p className="mt-3 break-all text-sm text-muted-foreground">{url}</p>
      ) : null}
      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
        トップから URL を投入してください。分析後、こちらの画面に同じ URL でアクセスできます。
      </p>
      <div className="mt-7">
        <Link
          href={
            reason === 'not_found' && url
              ? `/?url=${encodeURIComponent(url)}`
              : '/'
          }
          className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
        >
          {reason === 'not_found' ? 'この URL を分析する' : 'トップへ戻る'} →
        </Link>
      </div>
    </main>
  );
}
