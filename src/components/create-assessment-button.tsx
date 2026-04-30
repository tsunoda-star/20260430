'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Company 詳細ページに置く「チェックシートを作成」CTA。
 * クリック → guideline-suggestions を fetch → 選択モーダル → POST /assessments → 詳細へ遷移。
 */

interface SuggestionEntry {
  guideline: {
    id: string;
    code: string;
    name: string;
    category: string;
    isBaseline: boolean;
  };
  source: 'baseline' | 'industry' | 'manual';
  rationale?: string;
}

interface SuggestionsResponse {
  baseline: SuggestionEntry[];
  industryMatch: SuggestionEntry[];
  inferredIndustry: string;
}

interface Props {
  companyId: string;
  companyDisplayName: string;
}

export function CreateAssessmentButton({
  companyId,
  companyDisplayName,
}: Props): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState(`${companyDisplayName} のセキュリティチェック`);

  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/companies/${companyId}/guideline-suggestions`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`http_${res.status}`);
        return (await res.json()) as SuggestionsResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        // 既定: industryMatch のみ選択 (baseline は applyBaseline=true で自動付与される)
        const init = new Set<string>();
        for (const e of json.industryMatch) init.add(e.guideline.id);
        setSelected(init);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, data]);

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/assessments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyId,
          selectedGuidelineIds: Array.from(selected),
          applyBaseline: true,
          title: title.trim() || `${companyDisplayName} のチェックシート`,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`作成失敗 (${res.status}): ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as { id: string };
      router.push(`/app/assessments/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-md"
      >
        チェックシートを生成
        <span aria-hidden>→</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="チェックシート作成"
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden bg-background shadow-2xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-7 py-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                STEP 2 OF 2
              </p>
              <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight">
                チェックシートを生成
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                対象ガイドラインを選びます。ベースラインは自動で含まれます。
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-5">
              <div className="mb-6">
                <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                  タイトル
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-md border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  ガイドラインを読み込み中...
                </p>
              ) : error && !data ? (
                <p className="py-8 text-center text-sm text-red-600">{error}</p>
              ) : data ? (
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex items-baseline gap-2">
                      <h3 className="text-sm font-semibold">ベースライン</h3>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        必ず含まれる
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {data.baseline.map((e) => (
                        <li
                          key={e.guideline.id}
                          className="flex items-baseline gap-3 border-l-2 border-foreground/30 pl-3 py-1.5 text-sm"
                        >
                          <span className="font-mono text-[10px] uppercase text-muted-foreground">
                            {e.guideline.code}
                          </span>
                          <span className="flex-1">{e.guideline.name}</span>
                        </li>
                      ))}
                      {data.baseline.length === 0 ? (
                        <li className="text-sm text-muted-foreground">
                          ベースラインなし
                        </li>
                      ) : null}
                    </ul>
                  </div>

                  <div>
                    <div className="mb-2 flex items-baseline gap-2">
                      <h3 className="text-sm font-semibold">業種マッチ候補</h3>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {data.inferredIndustry}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {data.industryMatch.map((e) => {
                        const checked = selected.has(e.guideline.id);
                        return (
                          <li key={e.guideline.id}>
                            <label
                              className={
                                'flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-2.5 transition-colors ' +
                                (checked
                                  ? 'border-foreground bg-foreground/[0.03]'
                                  : 'hover:bg-muted/30')
                              }
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(e.guideline.id)}
                                disabled={submitting}
                                className="mt-0.5 accent-foreground"
                              />
                              <div className="flex-1 text-sm">
                                <p className="flex items-baseline gap-2">
                                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                                    {e.guideline.code}
                                  </span>
                                  <span className="font-medium">{e.guideline.name}</span>
                                </p>
                                {e.rationale ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {e.rationale}
                                  </p>
                                ) : null}
                              </div>
                            </label>
                          </li>
                        );
                      })}
                      {data.industryMatch.length === 0 ? (
                        <li className="text-sm text-muted-foreground">
                          業種マッチ候補なし
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t bg-muted/10 px-7 py-4">
              {error && data ? (
                <p className="mr-auto text-xs text-red-600">{error}</p>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-md px-4 py-2 text-sm hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || loading || !data}
                className="rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {submitting ? '作成中...' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
