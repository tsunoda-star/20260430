'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ChevronRight, Loader2 } from 'lucide-react';
import { useRole } from '@/lib/auth/role-context';

/**
 * spec.md §4.3 / Cycle 3.5: Reviewer に割当てられた "確認待ち" 項目通知.
 *
 * - role が reviewer または上位ロールの場合のみ描画
 * - Phase 6 で email/slack 拡張予定 — 現状は in-app の hint のみ
 * - GET /api/v1/me/reviewer-assignments を起動時に 1 回叩く
 */

interface AssignmentEntry {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  controlTitle: string;
  category: string;
  guidelineName: string;
  guidelineVersion: string;
  updatedAt: string;
}

interface ApiResponse {
  role: string;
  items: AssignmentEntry[];
}

export interface ReviewerAssignmentsCardProps {
  /** テスト用 fetch 差し替え */
  fetcher?: typeof fetch;
  /** 上位コンポーネントから初期値を渡す場合 (SSR) */
  initialItems?: AssignmentEntry[];
}

export function ReviewerAssignmentsCard({
  fetcher,
  initialItems,
}: ReviewerAssignmentsCardProps): JSX.Element | null {
  const { role, status } = useRole();
  const [items, setItems] = useState<AssignmentEntry[] | null>(initialItems ?? null);
  const [loading, setLoading] = useState(initialItems === undefined);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (initialItems !== undefined) return;
    const f = fetcher ?? fetch;
    let cancelled = false;
    void (async () => {
      try {
        const res = await f('/api/v1/me/reviewer-assignments', {
          credentials: 'same-origin',
        });
        if (cancelled) return;
        if (!res.ok) {
          setItems([]);
          return;
        }
        const json = (await res.json()) as ApiResponse;
        setItems(json.items);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, fetcher, initialItems]);

  // 描画判定: Reviewer 以上 (Reviewer/Editor/Admin/Owner) のみ
  if (status !== 'authenticated') return null;
  if (role === 'viewer') return null;
  // 0 件 / loading 中は静かにする (Reviewer に有用な hint がない場合バナー無し)
  if (loading) {
    return (
      <aside
        aria-busy="true"
        className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        担当の確認待ち項目を読み込み中…
      </aside>
    );
  }
  if (!items || items.length === 0) return null;

  return (
    <aside
      aria-labelledby="reviewer-assignments-heading"
      className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
    >
      <header className="mb-3 flex items-center gap-2">
        <ClipboardCheck className="size-4 text-accent" aria-hidden="true" />
        <h3
          id="reviewer-assignments-heading"
          className="font-heading text-h4 font-semibold tracking-tight"
        >
          確認待ち ({items.length})
        </h3>
      </header>
      <ul className="space-y-2">
        {items.slice(0, 10).map((it) => (
          <li key={it.id}>
            <Link
              href={`/app/assessments/${it.assessmentId}/items/${it.id}`}
              className="-mx-2 flex items-start gap-3 rounded-md p-2 text-sm transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <span className="flex-1">
                <span className="block font-medium leading-tight text-foreground">
                  {it.controlTitle}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {it.guidelineName} {it.guidelineVersion} · {it.category}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {it.assessmentTitle}
                </span>
              </span>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
