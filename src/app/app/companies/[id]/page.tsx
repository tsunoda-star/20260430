import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/server/db';
import { resolveTenantContext } from '@/lib/server/tenant';
import { isDevAuthBypassEnabled, devSessionUser } from '@/lib/auth/dev-bypass';
import { SESSION_COOKIE_NAME, verifyIdToken, type SessionUser } from '@/lib/auth/session';
import { CompanyProfileCard } from '@/components/company-profile-card';
import { CreateAssessmentButton } from '@/components/create-assessment-button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

function parseId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

interface InferredData {
  industry?: string;
  size?: string;
  rationale?: string;
  reasoning?: string;
  evidence?: string[];
}

const INDUSTRY_LABEL: Record<string, string> = {
  media: 'メディア・出版',
  finance: '金融',
  ecommerce: 'EC・小売',
  manufacturing: '製造業',
  healthcare: '医療・ヘルスケア',
  education: '教育',
  government: '公共・自治体',
  logistics: '物流・運輸',
  construction: '建設・不動産',
  food: '飲食・食品',
  it: 'IT・ソフトウェア',
  telecom: '通信',
  consulting: 'コンサル・専門サービス',
  other: 'その他',
  unknown: '不明',
};

const SIZE_LABEL: Record<string, string> = {
  startup: 'スタートアップ',
  sme: '中小企業',
  mid: '中堅',
  enterprise: '大手',
  unknown: '不明',
};

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/auth/login');
  const id = parseId(params.id);
  if (id === null) notFound();

  const { tenantId } = await resolveTenantContext(session);
  const company = await prisma.company.findFirst({
    where: { id, tenantId },
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
  if (!company) notFound();

  const inferred = (company.inferredData ?? {}) as InferredData;
  const reasoning = inferred.rationale ?? inferred.reasoning ?? null;
  const confidencePct = Math.max(0, Math.min(100, company.inferenceConfidence ?? 0));
  const displayName = company.displayName ?? company.domain;
  const industryLabel = INDUSTRY_LABEL[company.industry ?? 'unknown'] ?? company.industry;
  const sizeLabel = SIZE_LABEL[company.size ?? 'unknown'] ?? company.size;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:py-14">
      <nav className="mb-8 text-sm">
        <Link
          href="/"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 新しい URL を分析する
        </Link>
      </nav>

      <header className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {company.domain}
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {displayName}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          解析完了 {new Date(company.createdAt).toLocaleString('ja-JP')}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          AI 分析サマリー
        </h2>

        <ChatBubble icon="🤖" name="Claude (security analyst)" tone="brand">
          <p>
            <strong>{displayName}</strong> は <strong>{industryLabel}</strong> 業界の
            <strong>{sizeLabel}</strong> 規模の組織と推定しました。
            信頼度は <strong>{confidencePct}%</strong> です。
            {confidencePct < 60 ? (
              <span className="text-amber-700">
                {' '}
                信頼度が低めなので、内容を確認・修正することをお勧めします。
              </span>
            ) : null}
          </p>
          {reasoning ? <p className="mt-3 whitespace-pre-wrap">{reasoning}</p> : null}
          {inferred.evidence && inferred.evidence.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
              {inferred.evidence.slice(0, 5).map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          ) : null}
        </ChatBubble>

        <div className="mt-4">
          <CompanyProfileCard
            companyId={company.id.toString()}
            initialDisplayName={displayName}
            initialIndustry={company.industry}
            initialSize={company.size}
            confidencePct={confidencePct}
            reasoning={null}
          />
        </div>
      </section>

      <section className="mb-10 overflow-hidden rounded-2xl border bg-brand-soft">
        <div className="px-7 py-8 text-center md:px-10 md:py-10">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink">
            Next Step
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight md:text-3xl">
            27 ガイドライン横断のチェックシートを生成
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-foreground/70">
            上記の業種・規模に合わせて、IPA・METI・NIST など主要ガイドラインから
            必要な対策を自動で抽出します。
          </p>
          <div className="mt-7">
            <CreateAssessmentButton
              companyId={company.id.toString()}
              companyDisplayName={displayName}
            />
          </div>
        </div>
      </section>

      {company.assessments.length > 0 ? (
        <section>
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

function ChatBubble({
  icon,
  name,
  tone = 'neutral',
  children,
}: {
  icon: string;
  name: string;
  tone?: 'neutral' | 'brand';
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div
        aria-hidden
        className={
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ' +
          (tone === 'brand' ? 'bg-brand-soft' : 'bg-muted')
        }
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {name}
        </p>
        <div
          className={
            'rounded-2xl rounded-tl-sm px-5 py-4 text-sm leading-relaxed ' +
            (tone === 'brand' ? 'bg-brand-soft text-foreground' : 'bg-muted text-foreground')
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
