'use client';

import { useState } from 'react';

/**
 * 会社ドメインのファビコンを Google s2 サービス経由で取得して表示する。
 * - 失敗時は domain の頭文字でフォールバック (色は domain hash で安定)
 * - server / client 両方で render できるよう client component
 *
 * spec.md §8.2 (no PII): ドメインのみ送信、本文情報は送らない。
 */

interface Props {
  domain: string;
  size?: number;
  className?: string;
}

export function CompanyFavicon({
  domain,
  size = 56,
  className,
}: Props): JSX.Element {
  const [errored, setErrored] = useState(false);
  const url = `https://www.google.com/s2/favicons?sz=${Math.max(size * 2, 64)}&domain=${encodeURIComponent(domain)}`;

  // domain hash → 0-359 hue (識別性のため安定な色を選ぶ)
  let hue = 0;
  for (let i = 0; i < domain.length; i += 1) hue = (hue + domain.charCodeAt(i)) % 360;
  const initial = (domain[0] ?? '?').toUpperCase();

  if (errored) {
    return (
      <div
        aria-hidden
        className={
          'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border ' +
          (className ?? '')
        }
        style={{
          width: size,
          height: size,
          backgroundColor: `hsl(${hue}deg 70% 92%)`,
          color: `hsl(${hue}deg 60% 32%)`,
        }}
      >
        <span className="font-heading text-xl font-bold">{initial}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
      className={
        'shrink-0 rounded-xl border bg-background object-contain p-1.5 ' + (className ?? '')
      }
      style={{ width: size, height: size }}
    />
  );
}
