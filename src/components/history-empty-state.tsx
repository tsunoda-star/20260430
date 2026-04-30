'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, ChevronRight, Loader2 } from 'lucide-react';
import { useRole } from '@/lib/auth/role-context';

/**
 * S1 トップ画面下部の「履歴から再開」エリア.
 *
 * Cycle 7.3b: GET /api/v1/companies?recent=10 から最新 Company を取得し、
 * 0 件なら空状態、1 件以上ならカードリストとして表示する.
 *
 * 認証必須 (未認証時は何も描画しない).
 */

interface CompanyEntry {
  id: string;
  domain: string;
  displayName: string | null;
  industry: string | null;
  size: string | null;
  inferenceConfidence: number | null;
  createdAt: string;
}

interface ApiResponse {
  rows: CompanyEntry[];
}

export interface HistoryEmptyStateProps {
  /** テスト用 fetch 差し替え */
  fetcher?: typeof fetch;
  /** SSR/初期データ提供時 */
  initialItems?: CompanyEntry[];
}

export function HistoryEmptyState({
  fetcher,
  initialItems,
}: HistoryEmptyStateProps): JSX.Element | null {
  const { status } = useRole();
  const [items, setItems] = useState<CompanyEntry[] | null>(initialItems ?? null);
  const [loading, setLoading] = useState(initialItems === undefined);

  useEffect(() => {
    if (status !== 'authenticated' || initialItems !== undefined) {
      setLoading(false);
      return;
    }
    const f = fetcher ?? fetch;
    let cancelled = false;
    void (async () => {
      try {
        const res = await f('/api/v1/companies?recent=10', {
          credentials: 'same-origin',
        });
        if (cancelled) return;
        if (!res.ok) {
          setItems([]);
          return;
        }
        const json = (await res.json()) as ApiResponse;
        setItems(json.rows);
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

  if (status !== 'authenticated') return null;

  if (loading) {
    return (
      <section
        aria-busy="true"
        className="mt-16 inline-flex w-full max-w-2xl items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        履歴を読み込み中…
      </section>
    );
  }

  if (!items || items.length === 0) {
    return (
      <section
        aria-labelledby="history-heading"
        className="mt-16 w-full max-w-2xl rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center"
      >
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <History className="size-5" aria-hidden="true" />
        </div>
        <h2
          id="history-heading"
          className="mt-3 font-heading text-h4 font-semibold tracking-tight text-foreground"
        >
          履歴から再開
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          過去に分析した会社はここに表示されます。
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="history-heading"
      className="mt-16 w-full max-w-2xl rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <header className="mb-3 flex items-center gap-2">
        <History className="size-4 text-accent" aria-hidden="true" />
        <h2
          id="history-heading"
          className="font-heading text-h4 font-semibold tracking-tight text-foreground"
        >
          履歴から再開 ({items.length})
        </h2>
      </header>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id}>
            <Link
              href={`/app/companies/${c.id}`}
              className="-mx-2 flex items-center gap-3 rounded-md p-2 text-sm transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <span className="flex-1">
                <span className="block font-medium leading-tight text-foreground">
                  {c.displayName ?? c.domain}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {c.domain}
                  {c.industry ? ` · ${c.industry}` : ''}
                  {c.size ? ` · ${c.size}` : ''}
                  {c.inferenceConfidence !== null
                    ? ` · 信頼度 ${c.inferenceConfidence}`
                    : ''}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
