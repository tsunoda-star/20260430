'use client';

import { useEffect } from 'react';

/**
 * @axe-core/react を development 環境のみで動的ロードして a11y 違反をコンソール出力する。
 * production ビルドでは何もしない。
 */
export function AxeReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    void (async () => {
      const [{ default: axe }, ReactDOM, React] = await Promise.all([
        import('@axe-core/react'),
        import('react-dom'),
        import('react'),
      ]);
      if (cancelled) return;
      axe(React, ReactDOM, 1000);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
