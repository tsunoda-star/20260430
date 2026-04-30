'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * spec.md §5.3 / UX-VEF §3.2:
 * Viewer 専用フローでの「エクスポート」プライマリ CTA.
 *
 * - 視覚的に最も目立つ (大きい / アクセントカラー / アイコン左)
 * - 通常は Card 内のフッターに配置するが、本コンポーネントは presentation のみ
 *   (コンテキストは呼び出し側で決める)
 */

export interface ExportCtaProps {
  href: string;
  label?: string;
  className?: string;
}

export function ExportCta({
  href,
  label = 'エクスポート',
  className,
}: ExportCtaProps): JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 font-heading text-base font-semibold text-accent-foreground shadow-sm transition-colors duration-base',
        'hover:bg-accent/90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <Download className="size-5" aria-hidden="true" />
      {label}
    </Link>
  );
}
