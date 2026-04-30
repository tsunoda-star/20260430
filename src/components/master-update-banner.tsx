'use client';

import { useEffect, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { useRole } from '@/lib/auth/role-context';

/**
 * Cycle 4.4: ガイドラインマスタの新版がリリースされたことを通知するバナー.
 *
 * - GET /api/v1/master/latest-version の latestReleasedAt と localStorage の
 *   "sct.master.lastSeen" を比較し、より新しければ banner を表示
 * - 認証済みのみ表示
 * - dismiss すると localStorage を更新して非表示
 */

const STORAGE_KEY = 'sct.master.lastSeen';

interface ApiResponse {
  latestReleasedAt: string | null;
  latestVersion: string | null;
  activeGuidelineVersions: number;
}

export interface MasterUpdateBannerProps {
  fetcher?: typeof fetch;
}

export function MasterUpdateBanner({ fetcher }: MasterUpdateBannerProps): JSX.Element | null {
  const { status } = useRole();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const f = fetcher ?? fetch;
    let cancelled = false;
    void (async () => {
      try {
        const res = await f('/api/v1/master/latest-version', { credentials: 'same-origin' });
        if (cancelled) return;
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse;
        setData(json);
      } catch {
        // 静かに失敗 — バナーは表示しない
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, fetcher]);

  if (status !== 'authenticated' || !data || !data.latestReleasedAt || hidden) {
    return null;
  }
  const lastSeen =
    typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (lastSeen && Date.parse(lastSeen) >= Date.parse(data.latestReleasedAt)) {
    return null;
  }

  const dismiss = (): void => {
    if (typeof window !== 'undefined' && data.latestReleasedAt) {
      window.localStorage.setItem(STORAGE_KEY, data.latestReleasedAt);
    }
    setHidden(true);
  };

  const releasedDate = new Date(data.latestReleasedAt).toLocaleDateString('ja-JP');

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 border-b border-border bg-accent/10 px-4 py-3 text-sm text-foreground"
    >
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-accent" aria-hidden="true" />
        <span>
          ガイドラインマスタが更新されました — 最新版{' '}
          <strong className="font-semibold tabular-nums">{data.latestVersion}</strong> ({releasedDate})
          {' / '}
          有効ガイドライン <span className="tabular-nums">{data.activeGuidelineVersions}</span> 件
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="マスタ更新通知を閉じる"
        className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
