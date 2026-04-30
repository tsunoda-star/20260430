import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/server/db';
import { resolveTenantContext } from '@/lib/server/tenant';
import { isDevAuthBypassEnabled, devSessionUser } from '@/lib/auth/dev-bypass';
import { SESSION_COOKIE_NAME, verifyIdToken, type SessionUser } from '@/lib/auth/session';
import { AssessmentItemsList } from '@/components/assessment-items-list';
import { ExportButtons } from '@/components/export-buttons';

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

export default async function AssessmentDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  const id = parseId(params.id);
  if (id === null) notFound();

  const { tenantId } = await resolveTenantContext(session);

  const a = await prisma.assessment.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      baselineApplied: true,
      createdAt: true,
      company: {
        select: { id: true, domain: true, displayName: true, industry: true },
      },
      items: {
        orderBy: [{ controlItem: { priority: 'desc' } }, { id: 'asc' }],
        select: {
          id: true,
          status: true,
          note: true,
          dueDate: true,
          controlItem: {
            select: {
              id: true,
              title: true,
              category: true,
              priority: true,
              description: true,
              guidelineVersion: {
                select: {
                  version: true,
                  guideline: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!a) notFound();

  const totalCount = a.items.length;
  const doneCount = a.items.filter((it) => it.status === 'done').length;
  const inProgressCount = a.items.filter((it) => it.status === 'in_progress').length;
  const naCount = a.items.filter((it) => it.status === 'not_applicable').length;
  const openCount = totalCount - doneCount - inProgressCount - naCount;
  const progressPct =
    totalCount === 0 ? 0 : Math.round(((doneCount + naCount) / totalCount) * 100);

  const items = a.items.map((it) => ({
    id: it.id.toString(),
    status: it.status,
    note: it.note ?? '',
    dueDate: it.dueDate?.toISOString().slice(0, 10) ?? null,
    controlItem: {
      id: it.controlItem.id.toString(),
      title: it.controlItem.title,
      category: it.controlItem.category,
      priority: it.controlItem.priority,
      description: it.controlItem.description,
      guidelineCode: it.controlItem.guidelineVersion.guideline.code,
      guidelineName: it.controlItem.guidelineVersion.guideline.name,
    },
  }));

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 md:py-14">
      <nav className="mb-8 text-sm">
        {a.company ? (
          <Link
            href={`/app/companies/${a.company.id}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {a.company.displayName ?? a.company.domain}
          </Link>
        ) : (
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ← トップに戻る
          </Link>
        )}
      </nav>

      <header className="mb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {a.company?.domain ?? '—'} ・ {a.baselineApplied ? 'baseline 適用' : 'baseline なし'}
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {a.title}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          作成 {new Date(a.createdAt).toLocaleString('ja-JP')}
        </p>
      </header>

      <section className="mb-10 grid gap-3 md:grid-cols-4">
        <Stat label="完了" value={doneCount} accent="brand" />
        <Stat label="対応中" value={inProgressCount} accent="amber" />
        <Stat label="未着手" value={openCount} accent="neutral" />
        <Stat label="対象外" value={naCount} accent="neutral" />
      </section>

      <section className="mb-10 rounded-2xl border bg-brand-soft p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink">
            進捗
          </p>
          <p className="font-heading text-2xl font-bold tabular-nums text-brand-ink">
            {progressPct}%
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ExportButtons assessmentId={a.id.toString()} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          チェック項目 ({totalCount} 件)
        </h2>
        <AssessmentItemsList items={items} />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'brand' | 'amber' | 'neutral';
}): JSX.Element {
  const dotClass =
    accent === 'brand'
      ? 'bg-brand'
      : accent === 'amber'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/30';
  return (
    <div className="rounded-xl border bg-background p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 font-heading text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
