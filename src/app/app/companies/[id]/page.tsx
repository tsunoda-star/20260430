import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { prisma } from '@/lib/server/db';
import { resolveTenantContext } from '@/lib/server/tenant';
import { isDevAuthBypassEnabled, devSessionUser } from '@/lib/auth/dev-bypass';
import { SESSION_COOKIE_NAME, verifyIdToken, type SessionUser } from '@/lib/auth/session';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * S2: 分析結果 (Company プロフィール) 表示の最小ページ。
 * 解析直後の SSE done で router.push されるリダイレクト先。
 *
 * - dev bypass 時は SessionUser を inject
 * - 通常は cookie の id_token を verify
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
  confidence?: number;
  reasoning?: string;
  evidence?: string[];
}

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  const session = await getSession();
  if (!session) {
    // headers() で参照中なので redirect で OK
    void headers();
    redirect('/auth/login');
  }
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
    },
  });
  if (!company) notFound();

  const inferred = (company.inferredData ?? {}) as InferredData;
  const confidence = company.inferenceConfidence ?? 0;
  const confidencePct = Math.round(confidence * 100);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          ← トップに戻る
        </Link>
      </nav>

      <header className="mb-8 border-b pb-6">
        <p className="text-sm text-muted-foreground">{company.domain}</p>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
          {company.displayName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          解析完了: {new Date(company.createdAt).toLocaleString('ja-JP')}
        </p>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium text-muted-foreground">業種</h2>
          <p className="mt-1 text-lg font-semibold">{company.industry ?? '不明'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium text-muted-foreground">規模</h2>
          <p className="mt-1 text-lg font-semibold">{company.size ?? '不明'}</p>
        </div>
        <div className="rounded-lg border p-4 md:col-span-2">
          <h2 className="text-sm font-medium text-muted-foreground">推定信頼度</h2>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <p className="text-sm font-medium">{confidencePct}%</p>
          </div>
          {confidence < 0.6 ? (
            <p className="mt-2 text-xs text-amber-600">
              信頼度が低めです。手動レビューを推奨します。
            </p>
          ) : null}
        </div>
      </section>

      {inferred.reasoning ? (
        <section className="mb-8 rounded-lg border bg-muted/30 p-4">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">推定根拠</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{inferred.reasoning}</p>
          {inferred.evidence && inferred.evidence.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {inferred.evidence.slice(0, 5).map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-dashed p-6 text-center">
        <h2 className="font-heading text-lg font-semibold">次のステップ</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          チェックシート (Assessment) 作成画面は現在準備中です。
          <br />
          API は利用可能で、API ドキュメントから直接操作できます。
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          <code className="rounded bg-muted px-2 py-1 font-mono">
            POST /api/v1/assessments
          </code>
          <code className="rounded bg-muted px-2 py-1 font-mono">
            companyId: {company.id.toString()}
          </code>
        </div>
      </section>
    </main>
  );
}
