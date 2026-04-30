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
    <main className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <nav className="mb-6 text-sm text-muted-foreground">
        {a.company ? (
          <Link href={`/app/companies/${a.company.id}`} className="hover:underline">
            ← {a.company.displayName}
          </Link>
        ) : (
          <Link href="/" className="hover:underline">
            ← トップに戻る
          </Link>
        )}
      </nav>

      <header className="mb-8 border-b pb-6">
        <p className="text-xs text-muted-foreground">
          {a.company?.domain ?? '—'} ・ {a.baselineApplied ? 'ベースライン適用' : ''} ・
          作成: {new Date(a.createdAt).toLocaleString('ja-JP')}
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight md:text-3xl">
          {a.title}
        </h1>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">完了</p>
            <p className="mt-1 text-2xl font-bold">{doneCount}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">対応中</p>
            <p className="mt-1 text-2xl font-bold">{inProgressCount}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">対象外</p>
            <p className="mt-1 text-2xl font-bold">{naCount}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">全体</p>
            <p className="mt-1 text-2xl font-bold">{totalCount}</p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>進捗</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <ExportButtons assessmentId={a.id.toString()} />
        </div>
      </header>

      <AssessmentItemsList items={items} />
    </main>
  );
}
