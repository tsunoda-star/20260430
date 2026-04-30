'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useRole } from '@/lib/auth/role-context';
import { shouldRedirectViewer, VIEWER_HOME_PATH } from '@/lib/auth/viewer-guard';

/**
 * Viewer が S2 / S4 / S7 / S8 などの編集画面に到達した場合、
 * Viewer 専用ホーム (S1' = /app/viewer) へ即時リダイレクトする UX 補助。
 * 信頼境界はサーバー側 requireActionFromRequest。本コンポーネントは UX のみ。
 */

export function ViewerRouteGate(): null {
  const { role, status } = useRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!pathname) return;
    if (shouldRedirectViewer(role, pathname)) {
      router.replace(VIEWER_HOME_PATH);
    }
  }, [role, status, pathname, router]);

  return null;
}
