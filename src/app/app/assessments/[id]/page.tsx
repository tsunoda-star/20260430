import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/server/db';
import { resolveTenantContext } from '@/lib/server/tenant';
import { isDevAuthBypassEnabled, devSessionUser } from '@/lib/auth/dev-bypass';
import { SESSION_COOKIE_NAME, verifyIdToken, type SessionUser } from '@/lib/auth/session';
import { AssessmentItemsList } from '@/components/assessment-items-list';
import { ExportButtons } from '@/components/export-buttons';
import { CompanyFavicon } from '@/components/company-favicon';

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

  // Neon HTTPS adapter で nested include の取りこぼしを避けるため flat 検索する。
  const a = await prisma.assessment.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      baselineApplied: true,
      createdAt: true,
      companyId: true,
    },
  });
  if (!a) notFound();

  const aCompany = await prisma.company.findFirst({
    where: { id: a.companyId, tenantId },
    select: { id: true, domain: true, displayName: true, industry: true },
  });

  const rawItems = await prisma.assessmentItem.findMany({
    where: { tenantId, assessmentId: a.id },
    select: {
      id: true,
      status: true,
      note: true,
      dueDate: true,
      controlItemId: true,
    },
  });

  const controlIds = rawItems.map((it) => it.controlItemId);
  const controlRows =
    controlIds.length === 0
      ? []
      : await prisma.controlItem.findMany({
          where: { id: { in: controlIds } },
          select: {
            id: true,
            title: true,
            category: true,
            priority: true,
            description: true,
            guidelineVersionId: true,
          },
        });
  const controlById = new Map(controlRows.map((c) => [c.id.toString(), c]));

  const versionIds = Array.from(new Set(controlRows.map((c) => c.guidelineVersionId)));
  const versionRows =
    versionIds.length === 0
      ? []
      : await prisma.guidelineVersion.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, version: true, guidelineId: true },
        });
  const versionById = new Map(versionRows.map((v) => [v.id.toString(), v]));

  const guidelineIds = Array.from(new Set(versionRows.map((v) => v.guidelineId)));
  const guidelineRows =
    guidelineIds.length === 0
      ? []
      : await prisma.guideline.findMany({
          where: { id: { in: guidelineIds } },
          select: { id: true, code: true, name: true },
        });
  const guidelineById = new Map(guidelineRows.map((g) => [g.id.toString(), g]));

  // priority desc, id asc でソート
  rawItems.sort((x, y) => {
    const cx = controlById.get(x.controlItemId.toString());
    const cy = controlById.get(y.controlItemId.toString());
    const px = cx?.priority ?? 0;
    const py = cy?.priority ?? 0;
    if (px !== py) return py - px;
    return x.id < y.id ? -1 : 1;
  });

  const totalCount = rawItems.length;
  const doneCount = rawItems.filter((it) => it.status === 'done').length;
  const inProgressCount = rawItems.filter((it) => it.status === 'in_progress').length;
  const naCount = rawItems.filter((it) => it.status === 'not_applicable').length;
  const openCount = totalCount - doneCount - inProgressCount - naCount;
  const progressPct =
    totalCount === 0 ? 0 : Math.round(((doneCount + naCount) / totalCount) * 100);

  const items = rawItems.map((it) => {
    const ci = controlById.get(it.controlItemId.toString());
    const ver = ci ? versionById.get(ci.guidelineVersionId.toString()) : undefined;
    const g = ver ? guidelineById.get(ver.guidelineId.toString()) : undefined;
    return {
      id: it.id.toString(),
      status: it.status,
      note: it.note ?? '',
      dueDate: it.dueDate?.toISOString().slice(0, 10) ?? null,
      controlItem: {
        id: ci?.id.toString() ?? it.controlItemId.toString(),
        title: ci?.title ?? '(削除済み)',
        category: ci?.category ?? '—',
        priority: ci?.priority ?? 0,
        description: ci?.description ?? null,
        guidelineCode: g?.code ?? '—',
        guidelineName: g?.name ?? '—',
      },
    };
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 md:py-14">
      <nav className="mb-8 text-sm">
        {aCompany ? (
          <Link
            href={`/results?url=${encodeURIComponent(`https://${aCompany.domain}/`)}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {aCompany.displayName ?? aCompany.domain}
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

      <header className="mb-10 flex items-start gap-5">
        {aCompany ? <CompanyFavicon domain={aCompany.domain} size={56} /> : null}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {aCompany?.domain ?? '—'} ・{' '}
            {a.baselineApplied ? 'baseline 適用' : 'baseline なし'}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {a.title}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            作成 {new Date(a.createdAt).toLocaleString('ja-JP')}
          </p>
        </div>
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
