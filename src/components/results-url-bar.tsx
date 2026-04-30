'use client';

import { useState } from 'react';

/**
 * 結果ページの上部に出る「分析対象 URL バー」。
 * - URL を表示
 * - クリップボードへコピー
 * - X (Twitter) で共有 (メタテキスト + 結果ページの URL)
 * - 最終更新と再分析ボタン
 */

interface Props {
  url: string;
  fetchedAt: string | null;
}

export function ResultsUrlBar({ url, fetchedAt }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : `/results?url=${encodeURIComponent(url)}`;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${url} のセキュリティチェック`,
  )}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2 rounded-full border bg-background px-2 py-1.5 shadow-sm">
        <div className="flex flex-1 items-center gap-2 overflow-hidden px-3">
          <span aria-hidden className="text-muted-foreground">
            🔍
          </span>
          <span className="truncate text-sm">{url}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="URL をコピー"
        >
          <span aria-hidden>📋</span>
          <span className="hidden sm:inline">{copied ? 'コピー済' : 'コピー'}</span>
        </button>
        <a
          href={tweetHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="X でシェア"
        >
          <span aria-hidden>𝕏</span>
          <span className="hidden sm:inline">シェア</span>
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          ソース:{' '}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-ink hover:underline"
          >
            {url}
          </a>
        </span>
        {fetchedAt ? (
          <span>
            最終更新:{' '}
            {new Date(fetchedAt).toLocaleString('ja-JP', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : null}
        <a
          href={`/?url=${encodeURIComponent(url)}`}
          className="text-brand-ink hover:underline"
        >
          ↻ 再分析
        </a>
      </div>
    </div>
  );
}
