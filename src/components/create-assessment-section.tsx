'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Company 詳細ページの「Next Step」CTA + チェックシート作成フォームを
 * 1 セクションにまとめたインラインアコーディオン。
 *
 * - 初期状態: 緑パネル + 「チェックシートを生成」ピルボタン
 * - 展開状態: パネル下に作成フォーム (タイトル + ガイドライン選択) が
 *   スライドダウン。ポップアップ/モーダルではなくインラインで開く。
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

export function CreateAssessmentSection({
  companyId,
  companyDisplayName,
}: Props): JSX.Element {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState(`${companyDisplayName} のセキュリティチェック`);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded || data) return;
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
  }, [expanded, companyId, data]);

  // 展開時にフォームへスムーススクロール
  useEffect(() => {
    if (expanded) {
      const t = setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [expanded]);

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
      <section className="overflow-hidden rounded-2xl border bg-brand-soft">
        <div className="px-7 py-8 text-center md:px-10 md:py-10">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink">
            Next Step
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight md:text-3xl">
            27 ガイドライン横断のチェックシートを生成
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-foreground/70">
            上記の業種・規模に合わせて、IPA・METI・NIST など主要ガイドラインから
            必要な対策を自動で抽出します。
          </p>
          <div className="mt-7">
            {!expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-ink hover:shadow-md"
              >
                チェックシートを生成
                <span aria-hidden>↓</span>
              </button>
            ) : (
              <p className="text-sm text-brand-ink">
                ↓ 下のフォームでガイドラインを選んでください
              </p>
            )}
          </div>
        </div>
      </section>

      {expanded ? (
        <section
          ref={formRef}
          aria-label="チェックシート作成フォーム"
          className="mt-4 overflow-hidden rounded-2xl border bg-background"
        >
          <header className="flex items-start justify-between gap-3 border-b px-6 py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-brand-ink">
                FORM
              </p>
              <h3 className="mt-1 font-heading text-lg font-bold tracking-tight">
                対象ガイドラインを選ぶ
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              disabled={submitting}
              className="rounded-full px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              閉じる
            </button>
          </header>

          <div className="space-y-6 px-6 py-6">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                タイトル
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                className="w-full rounded-md border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ガイドラインを読み込み中...
              </p>
            ) : error && !data ? (
              <p className="py-8 text-center text-sm text-red-600">{error}</p>
            ) : data ? (
              <>
                <div>
                  <div className="mb-2 flex items-baseline gap-2">
                    <h4 className="text-sm font-semibold">ベースライン</h4>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      必ず含まれる
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {data.baseline.map((e) => (
                      <li
                        key={e.guideline.id}
                        className="flex items-baseline gap-3 border-l-2 border-brand/40 py-1.5 pl-3 text-sm"
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
                    <h4 className="text-sm font-semibold">業種マッチ候補</h4>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {data.inferredIndustry}
                    </span>
                  </div>
                  <ul className="grid gap-1.5 md:grid-cols-2">
                    {data.industryMatch.map((e) => {
                      const checked = selected.has(e.guideline.id);
                      return (
                        <li key={e.guideline.id}>
                          <label
                            className={
                              'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ' +
                              (checked
                                ? 'border-brand bg-brand-soft'
                                : 'hover:bg-muted/30')
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(e.guideline.id)}
                              disabled={submitting}
                              className="mt-0.5 accent-brand"
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
                      <li className="col-span-full text-sm text-muted-foreground">
                        業種マッチ候補なし — ベースラインのみで作成します
                      </li>
                    ) : null}
                  </ul>
                </div>
              </>
            ) : null}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t bg-muted/10 px-6 py-4">
            {error && data ? (
              <p className="mr-auto text-xs text-red-600">{error}</p>
            ) : (
              <p className="mr-auto text-xs text-muted-foreground">
                {data
                  ? `${selected.size + (data.baseline.length)} ガイドライン選択中`
                  : ''}
              </p>
            )}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              disabled={submitting}
              className="rounded-full px-4 py-2 text-sm hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || loading || !data}
              className="rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-50"
            >
              {submitting ? '作成中...' : '作成する'}
            </button>
          </footer>
        </section>
      ) : null}
    </>
  );
}
