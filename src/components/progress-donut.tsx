import { cn } from '@/lib/utils';

/**
 * spec.md §4 + Cycle 4.3 + design-requirements.md tabular-nums:
 * 完了率を SVG ドーナツで表示。外部チャートライブラリ依存なし。
 */

export interface ProgressDonutProps {
  /** 0..1 の比率 */
  rate: number;
  /** 内訳 (任意) */
  done?: number;
  total?: number;
  /** 0..N の警告件数 (期限超過など) */
  alertCount?: number;
  size?: number; // px
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
}

export function ProgressDonut({
  rate,
  done,
  total,
  alertCount,
  size = 160,
  strokeWidth = 14,
  className,
  ariaLabel,
}: ProgressDonutProps): JSX.Element {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(rate) ? rate : 0));
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped);
  const percent = Math.round(clamped * 100);

  return (
    <figure
      className={cn('inline-flex flex-col items-center', className)}
      aria-label={ariaLabel ?? `完了率 ${percent}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-hidden="true"
      >
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${c} ${c})`}
        />
        <text
          x={c}
          y={c}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-heading"
          fontSize={size * 0.22}
          fontWeight={700}
          fill="hsl(var(--foreground))"
          style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
        >
          {percent}%
        </text>
      </svg>
      <figcaption className="mt-2 text-center text-sm text-muted-foreground">
        {done !== undefined && total !== undefined ? (
          <span className="tabular-nums">
            {done} / {total} 完了
          </span>
        ) : null}
        {alertCount !== undefined && alertCount > 0 ? (
          <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive tabular-nums">
            期限超過 {alertCount}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
