'use client';

import { motion } from 'motion/react';
import { CheckCircle2, Loader2, AlertTriangle, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StreamStatus } from '@/hooks/use-event-stream';

/**
 * spec.md §4.1 / Cycle 3.4: クロール → LLM 推定 進捗表示.
 * Skeleton (idle/connecting) → Streaming (active stage) → 完了 (done)
 *
 * - motion/react 200ms / compositor props (opacity / transform) のみ
 * - cancel / retry ボタン付き
 */

export interface ProgressStage {
  id: string;
  label: string;
  state: 'pending' | 'active' | 'done' | 'failed';
  detail?: string;
}

export interface ProgressStreamProps {
  status: StreamStatus;
  stages: ProgressStage[];
  errorMessage?: string | null;
  onCancel: () => void;
  onRetry?: () => void;
  className?: string;
}

const ICON_VARIANT = {
  pending: <span className="block size-2 rounded-full bg-muted-foreground/30" aria-hidden />,
  active: <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />,
  done: <CheckCircle2 className="size-4 text-accent" aria-hidden="true" />,
  failed: <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />,
} as const;

export function ProgressStream({
  status,
  stages,
  errorMessage,
  onCancel,
  onRetry,
  className,
}: ProgressStreamProps): JSX.Element {
  const failed = status === 'error' || stages.some((s) => s.state === 'failed');
  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm',
        className,
      )}
    >
      <header className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-h4 font-semibold tracking-tight">分析の進捗</h2>
        {status === 'streaming' || status === 'connecting' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            aria-label="分析を中止"
          >
            <X className="mr-1 size-4" aria-hidden="true" />
            中止
          </Button>
        ) : null}
      </header>
      <ol className="space-y-3" aria-label="ステージ一覧">
        {stages.map((s) => (
          <li key={s.id} className="flex items-start gap-3 text-sm">
            <span className="mt-1 inline-flex size-4 shrink-0 items-center justify-center">
              {ICON_VARIANT[s.state]}
            </span>
            <div className="flex-1">
              <p
                className={cn(
                  'font-medium leading-tight',
                  s.state === 'pending' && 'text-muted-foreground',
                  s.state === 'failed' && 'text-destructive',
                )}
              >
                {s.label}
              </p>
              {s.detail ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {failed && errorMessage ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden="true" />
            分析でエラーが発生しました
          </p>
          <p className="mt-1 text-xs leading-relaxed">{errorMessage}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3"
            >
              <RotateCw className="mr-1 size-4" aria-hidden="true" />
              再試行
            </Button>
          ) : null}
        </div>
      ) : null}
    </motion.section>
  );
}
