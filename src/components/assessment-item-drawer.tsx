'use client';

import { useEffect, useRef, useState } from 'react';
import type { AssessmentItemView, ItemStatus } from './assessment-items-list';

/**
 * 項目クリックで開くドロワー (右からスライドイン)。
 * - ステータス変更 (PATCH /assessment-items/:id)
 * - メモ編集 (PATCH /assessment-items/:id)
 * - AI 質問 (POST /assessment-items/:id/ai-chat, SSE)
 */

const STATUS_OPTIONS: ItemStatus[] = ['open', 'in_progress', 'done', 'not_applicable'];
const STATUS_LABEL: Record<ItemStatus, string> = {
  open: '未着手',
  in_progress: '対応中',
  done: '完了',
  not_applicable: '対象外',
};

interface Props {
  item: AssessmentItemView;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<AssessmentItemView>) => void;
}

interface AiAnswer {
  question: string;
  answer: string;
  loading: boolean;
  error: string | null;
}

export function AssessmentItemDrawer({ item, onClose, onUpdate }: Props): JSX.Element {
  const [note, setNote] = useState(item.note);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [question, setQuestion] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setNote(item.note);
  }, [item.id, item.note]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = async (patch: Record<string, unknown>): Promise<void> => {
    setError(null);
    const res = await fetch(`/api/v1/assessment-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`保存失敗 (${res.status}): ${body.slice(0, 160)}`);
    }
  };

  const updateStatus = async (s: ItemStatus): Promise<void> => {
    setSavingField('status');
    try {
      await patch({ status: s });
      onUpdate(item.id, { status: s });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingField(null);
    }
  };

  const saveNote = async (): Promise<void> => {
    setSavingField('note');
    try {
      await patch({ note });
      onUpdate(item.id, { note });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingField(null);
    }
  };

  const askAi = async (): Promise<void> => {
    const q = question.trim();
    if (!q) return;
    setAnswer({ question: q, answer: '', loading: true, error: null });
    setQuestion('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`/api/v1/assessment-items/${item.id}/ai-chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`AI 呼び出し失敗 (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        let event = '';
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) {
            const payload = line.slice(5).trim();
            try {
              const parsed = JSON.parse(payload) as { delta?: string };
              if (event === 'chunk' && typeof parsed.delta === 'string') {
                acc += parsed.delta;
                setAnswer({ question: q, answer: acc, loading: true, error: null });
              }
            } catch {
              /* ignore non-json */
            }
          } else if (line === '') event = '';
        }
      }
      setAnswer({ question: q, answer: acc, loading: false, error: null });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setAnswer((prev) =>
        prev
          ? { ...prev, loading: false, error: e instanceof Error ? e.message : String(e) }
          : null,
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.controlItem.title}
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{item.controlItem.guidelineCode}</span> ・{' '}
              {item.controlItem.guidelineName}
            </p>
            <h2 className="mt-1 font-heading text-lg font-bold leading-snug">
              {item.controlItem.title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.controlItem.category}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {item.controlItem.description ? (
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                内容
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {item.controlItem.description}
              </p>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ステータス
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateStatus(s)}
                  disabled={savingField === 'status'}
                  className={
                    'rounded-full border px-3.5 py-1.5 text-xs transition-colors ' +
                    (item.status === s
                      ? s === 'done'
                        ? 'border-brand bg-brand text-white'
                        : 'border-foreground bg-foreground text-background'
                      : 'hover:bg-muted')
                  }
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                メモ
              </h3>
              <button
                type="button"
                onClick={saveNote}
                disabled={savingField === 'note' || note === item.note}
                className="text-xs text-foreground underline-offset-2 hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {savingField === 'note' ? '保存中...' : '保存'}
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={8000}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="自社の状況や対応メモを記載..."
            />
          </section>

          <section className="rounded-lg border bg-muted/20 p-4">
            <h3 className="mb-2 text-sm font-semibold">AI に聞く</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              この項目について Claude に質問できます。
              個人情報・機密情報は送信されません。
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    askAi();
                  }
                }}
                placeholder="例: うちの規模ではどこまで対応すべき?"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={askAi}
                disabled={!question.trim() || answer?.loading}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-ink disabled:opacity-50"
              >
                送信
              </button>
            </div>

            {answer ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Q. {answer.question}</p>
                <div className="rounded-md bg-background p-3 text-sm leading-relaxed">
                  {answer.answer ? (
                    <LinkifiedText text={answer.answer} />
                  ) : answer.loading ? (
                    '考え中...'
                  ) : (
                    '(空)'
                  )}
                  {answer.loading ? (
                    <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-foreground/60" />
                  ) : null}
                </div>
                {answer.error ? (
                  <p className="text-xs text-red-600">{answer.error}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        {error ? (
          <div className="border-t bg-red-50 px-6 py-2 text-xs text-red-700">{error}</div>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * URL を <a> タグに自動変換するシンプルなレンダラ。
 * - http(s):// のみ対象、改行はそのまま `\n` で保持
 * - rel="noopener noreferrer" で外部参照を保護
 */
function LinkifiedText({ text }: { text: string }): JSX.Element {
  const parts: Array<string | { url: string }> = [];
  const re = /(https?:\/\/[^\s<>"]+)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const url = m[1] ?? m[0];
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push({ url });
    lastIndex = m.index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <a
            key={i}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-brand-ink underline underline-offset-2 hover:text-brand"
          >
            {p.url}
          </a>
        ),
      )}
    </span>
  );
}
