import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * spec.md / responsive-guidelines.md / Cycle 4.5: モバイル時に table → card を切替.
 *
 * - sm 以上 (>=640px) は <table> を表示
 * - sm 未満は children を Card 列挙でレンダリング
 *
 * モバイル view を分離する責務はあえて呼び出し側に持たせ、
 * 本コンポーネントは "切替コンテナ" のみ提供する (柔軟な使い分けのため)。
 */

export interface ResponsiveTableProps {
  /** 大画面用 (>= sm) のテーブルマークアップ */
  table: ReactNode;
  /** 小画面用 (< sm) のカード列挙 */
  cards: ReactNode;
  className?: string;
  /** 切替ブレークポイント (Tailwind classname). 既定: 'sm' (640px) */
  breakpoint?: 'sm' | 'md' | 'lg';
}

const HIDE_BELOW: Record<NonNullable<ResponsiveTableProps['breakpoint']>, string> = {
  sm: 'hidden sm:block',
  md: 'hidden md:block',
  lg: 'hidden lg:block',
};

const HIDE_ABOVE: Record<NonNullable<ResponsiveTableProps['breakpoint']>, string> = {
  sm: 'block sm:hidden',
  md: 'block md:hidden',
  lg: 'block lg:hidden',
};

export function ResponsiveTable({
  table,
  cards,
  className,
  breakpoint = 'sm',
}: ResponsiveTableProps): JSX.Element {
  return (
    <div className={cn('w-full', className)}>
      <div className={HIDE_BELOW[breakpoint]}>{table}</div>
      <div className={HIDE_ABOVE[breakpoint]}>{cards}</div>
    </div>
  );
}
