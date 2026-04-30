'use client';

import Link from 'next/link';
import { Eye, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRole } from '@/lib/auth/role-context';
import { VIEWER_HOME_PATH } from '@/lib/auth/viewer-guard';

/**
 * spec.md §5.3 + UX-VEF-20260430 §3.1:
 * Viewer ログイン時の「あなたは Viewer です — 閲覧とエクスポートが可能です」バナー.
 *
 * - localStorage で 3 回まで自動表示 (それ以降は dismiss 後に再表示しない)
 * - role !== 'viewer' / unauthenticated 時は描画しない
 * - 配色: Background Subtle (--secondary) / Text Primary (--foreground)
 */

const STORAGE_KEY = 'sct.viewerBanner.dismissCount';
const MAX_AUTO_SHOW = 3;

export function WhyDisabledBanner(): JSX.Element | null {
  const { role } = useRole();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (role !== 'viewer') {
      setOpen(false);
      return;
    }
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
    const seen = raw ? Number.parseInt(raw, 10) : 0;
    setOpen(Number.isFinite(seen) ? seen < MAX_AUTO_SHOW : true);
  }, [role]);

  if (role !== 'viewer' || !open) return null;

  const dismiss = (): void => {
    setOpen(false);
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const next = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 border-b border-border bg-secondary px-4 py-3 text-sm text-foreground"
    >
      <div className="flex items-center gap-2">
        <Eye className="size-4 text-accent" aria-hidden="true" />
        <span>
          あなたは <strong className="font-semibold">Viewer</strong> です —
          閲覧とエクスポートが可能です。
        </span>
        <Link
          href={VIEWER_HOME_PATH}
          className="ml-2 text-accent underline-offset-4 hover:underline"
        >
          エクスポート画面へ
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="バナーを閉じる"
        className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
