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
}

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

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 md:py-16">
      <nav className="mb-8 text-sm">
        <Link
          href="/"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ← トップに戻る
        </Link>
      </nav>

      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {company.domain}
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {displayName}
        </h1>
        <p className="mt-3 text-xs text-muted-foreground">
          解析完了 {new Date(company.createdAt).toLocaleString('ja-JP')}
        </p>
      </header>

      <div className="mb-10">
        <CompanyProfileCard
          companyId={company.id.toString()}
          initialDisplayName={displayName}
          initialIndustry={company.industry}
          initialSize={company.size}
          confidencePct={confidencePct}
          reasoning={reasoning}
        />
      </div>

      <section className="mb-10 rounded-xl border bg-muted/20 p-8 text-center">
        <p className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          NEXT STEP
        </p>
        <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight">
          チェックシートを生成する
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          上記の業種・規模に合わせて、IPA・METI・NIST など 27 ガイドライン横断の
          チェック項目を自動で集めます。
        </p>
        <div className="mt-6">
          <CreateAssessmentButton
            companyId={company.id.toString()}
            companyDisplayName={displayName}
          />
        </div>
      </section>

      {company.assessments.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            最近のチェックシート
          </h2>
          <ul className="divide-y rounded-lg border">
            {company.assessments.map((a) => (
              <li key={a.id.toString()}>
                <Link
                  href={`/app/assessments/${a.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
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
