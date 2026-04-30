'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'motion/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { urlSchema, type UrlFormInput } from '@/lib/validation/url-schema';
import { useRole } from '@/lib/auth/role-context';
import { ExportCta } from '@/components/export-cta';
import { VIEWER_HOME_PATH } from '@/lib/auth/viewer-guard';
import {
  ProgressStream,
  type ProgressStage,
} from '@/components/progress-stream';
import { useEventStream, type StreamEvent } from '@/hooks/use-event-stream';

/**
 * S1 トップ画面 URL 入力フォーム.
 * Cycle 7.3 で POST /api/v1/companies/stream に SSE 配線済。
 * 完了後は /app/companies/{id} に遷移する。
 */

const INITIAL_STAGES: ProgressStage[] = [
  { id: 'validating', label: 'URL を検証中', state: 'pending' },
  { id: 'crawling', label: 'サイトを解析中', state: 'pending' },
  { id: 'estimating', label: 'AI が業界・規模を推定中', state: 'pending' },
  { id: 'persisting', label: '保存中', state: 'pending' },
];


export function UrlInputForm(): JSX.Element {
  const { can, role, status: roleStatus } = useRole();
  const router = useRouter();

  const stream = useEventStream();
  const [stages, setStages] = useState<ProgressStage[]>(INITIAL_STAGES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UrlFormInput>({
    resolver: zodResolver(urlSchema),
    mode: 'onSubmit',
  });

  const handleEvent = useCallback(
    (ev: StreamEvent) => {
      switch (ev.event) {
        case 'validating':
        case 'crawling':
        case 'estimating':
        case 'persisting': {
          setStages((prev) => {
            const idx = prev.findIndex((s) => s.id === ev.event);
            if (idx < 0) return prev;
            return prev.map((s, i) => {
              if (i < idx) return { ...s, state: 'done' };
              if (i === idx) {
                const data = ev.data as Record<string, unknown> | null;
                return {
                  ...s,
                  state: 'done',
                  detail: data ? summariseStage(ev.event, data) : undefined,
                };
              }
              return s;
            });
          });
          // 次のステージを active 表示にする
          setStages((prev) => {
            const next = prev.findIndex((s) => s.state === 'pending');
            if (next < 0) return prev;
            return prev.map((s, i) =>
              i === next ? { ...s, state: 'active' } : s,
            );
          });
          break;
        }
        case 'done': {
          const data = ev.data as {
            id: string;
            domain?: string;
            degraded?: boolean;
            needsManualReview?: boolean;
          };
          setStages((prev) => prev.map((s) => ({ ...s, state: 'done' })));
          if (data.degraded) {
            toast.warning('AI 機能が一時停止中のため、ルールベースで推定しました', {
              description: '属性を手動で確認・修正してください',
            });
          } else if (data.needsManualReview) {
            toast.info('推定の信頼度が低めです', {
              description: '次の画面で属性をご確認ください',
            });
          }
          if (data.id) {
            router.push(`/app/companies/${data.id}`);
          }
          break;
        }
        case 'error': {
          const data = ev.data as
            | { code?: string; reason?: string; message?: string }
            | string;
          const detail =
            typeof data === 'string'
              ? data
              : (data.message ?? data.reason ?? data.code ?? 'unknown');
          setErrorMessage(detail);
          setStages((prev) =>
            prev.map((s) => (s.state === 'active' ? { ...s, state: 'failed' } : s)),
          );
          break;
        }
        default:
          break;
      }
    },
    [router],
  );

  const onValid = useCallback(
    async (data: UrlFormInput) => {
      setStreamActive(true);
      setErrorMessage(null);
      setStages(
        INITIAL_STAGES.map((s, i) => ({
          ...s,
          state: i === 0 ? 'active' : 'pending',
        })),
      );
      stream.start({
        url: '/api/v1/companies/stream',
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: data.url }),
        },
        onEvent: handleEvent,
        onError: (msg) => setErrorMessage(msg),
      });
    },
    [stream, handleEvent],
  );

  const onCancel = useCallback(() => {
    stream.cancel();
    setStreamActive(false);
    setStages((prev) =>
      prev.map((s) => (s.state === 'active' ? { ...s, state: 'pending' } : s)),
    );
  }, [stream]);

  const onRetry = useCallback(() => {
    setErrorMessage(null);
    setStages(
      INITIAL_STAGES.map((s, i) => ({
        ...s,
        state: i === 0 ? 'active' : 'pending',
      })),
    );
    stream.retry();
  }, [stream]);

  // spec.md §5.3: Viewer は URL 入力 disabled, エクスポートのみ
  if (roleStatus === 'authenticated' && role === 'viewer') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="mt-10 flex flex-col items-center gap-3 text-center"
        aria-live="polite"
      >
        <p className="text-base text-muted-foreground">
          閲覧者 (Viewer) はエクスポート機能のみご利用いただけます
        </p>
        <ExportCta href={VIEWER_HOME_PATH} label="エクスポート画面を開く" />
      </motion.div>
    );
  }

  const inputDisabled =
    !can('company.create') && roleStatus === 'authenticated';
  const submitting =
    stream.status === 'connecting' || stream.status === 'streaming';
  const validationError = errors.url?.message;

  const showProgress =
    streamActive &&
    stream.status !== 'idle' &&
    stream.status !== 'cancelled';

  return (
    <div className="mt-10 w-full">
      <motion.form
        onSubmit={handleSubmit(onValid)}
        noValidate
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
        aria-label="URL を入力してチェックシートを生成"
      >
        <Label htmlFor="company-url" className="sr-only">
          分析対象の URL
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="company-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://your-company.example.jp"
            aria-invalid={validationError ? 'true' : 'false'}
            aria-describedby={validationError ? 'company-url-error' : undefined}
            disabled={submitting || inputDisabled}
            className="h-12 flex-1 text-base"
            {...register('url')}
          />
          <Button
            type="submit"
            size="lg"
            disabled={submitting || inputDisabled}
            className="h-12 rounded-full bg-brand text-white hover:bg-brand-ink sm:w-44"
          >
            {submitting ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <>
                分析を開始
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
        {validationError ? (
          <p
            id="company-url-error"
            role="alert"
            className="mt-2 text-sm text-destructive"
          >
            {validationError}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            公開情報のみクロールします (SSRF対策済み)。https のみ対応。
          </p>
        )}
      </motion.form>

      {showProgress ? (
        <div className="mt-6">
          <ProgressStream
            status={stream.status}
            stages={stages}
            errorMessage={errorMessage}
            onCancel={onCancel}
            onRetry={onRetry}
          />
        </div>
      ) : null}
    </div>
  );
}

function summariseStage(eventName: string, data: Record<string, unknown>): string {
  switch (eventName) {
    case 'validating':
      return 'URL 検証 OK';
    case 'crawling': {
      const title = typeof data.title === 'string' ? data.title : '';
      return title || 'サイト解析完了';
    }
    case 'estimating': {
      const industry =
        typeof data.industry === 'string' ? data.industry : 'unknown';
      const confidence =
        typeof data.confidence === 'number' ? data.confidence : null;
      return confidence !== null
        ? `${industry} (信頼度 ${confidence})`
        : industry;
    }
    case 'persisting':
      return '保存完了';
    default:
      return '';
  }
}
