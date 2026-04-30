'use client';

import { useState } from 'react';

/**
 * 解析後の Company プロフィールを表示・修正できる確認カード。
 * - inferred / userOverrides は API 側で merge 済 (column 値が最新)
 * - 編集モードで displayName / industry / size を更新 (PATCH /api/v1/companies/:id)
 */

const INDUSTRY_OPTIONS = [
  { id: 'media', label: 'メディア・出版' },
  { id: 'finance', label: '金融' },
  { id: 'ecommerce', label: 'EC・小売' },
  { id: 'manufacturing', label: '製造業' },
  { id: 'healthcare', label: '医療・ヘルスケア' },
  { id: 'education', label: '教育' },
  { id: 'government', label: '公共・自治体' },
  { id: 'logistics', label: '物流・運輸' },
  { id: 'construction', label: '建設・不動産' },
  { id: 'food', label: '飲食・食品' },
  { id: 'it', label: 'IT・ソフトウェア' },
  { id: 'telecom', label: '通信' },
  { id: 'consulting', label: 'コンサル・専門サービス' },
  { id: 'other', label: 'その他' },
  { id: 'unknown', label: '不明' },
];

const SIZE_OPTIONS = [
  { id: 'startup', label: 'スタートアップ (〜10名)' },
  { id: 'sme', label: '中小企業 (〜300名)' },
  { id: 'mid', label: '中堅 (〜1000名)' },
  { id: 'enterprise', label: '大手 (1000名超)' },
  { id: 'unknown', label: '不明' },
];

interface Props {
  companyId: string;
  initialDisplayName: string;
  initialIndustry: string | null;
  initialSize: string | null;
  confidencePct: number;
  reasoning: string | null;
}

export function CompanyProfileCard({
  companyId,
  initialDisplayName,
  initialIndustry,
  initialSize,
  confidencePct,
  reasoning,
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [industry, setIndustry] = useState(initialIndustry ?? 'unknown');
  const [size, setSize] = useState(initialSize ?? 'unknown');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表示用の現在値 (saved した結果を反映)
  const [currentDisplayName, setCurrentDisplayName] = useState(initialDisplayName);
  const [currentIndustry, setCurrentIndustry] = useState(initialIndustry ?? 'unknown');
  const [currentSize, setCurrentSize] = useState(initialSize ?? 'unknown');

  const industryLabel =
    INDUSTRY_OPTIONS.find((o) => o.id === currentIndustry)?.label ?? currentIndustry;
  const sizeLabel = SIZE_OPTIONS.find((o) => o.id === currentSize)?.label ?? currentSize;

  const cancel = (): void => {
    setDisplayName(currentDisplayName);
    setIndustry(currentIndustry);
    setSize(currentSize);
    setEditing(false);
    setError(null);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, industry, size }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`保存失敗 (${res.status}): ${t.slice(0, 200)}`);
      }
      setCurrentDisplayName(displayName);
      setCurrentIndustry(industry);
      setCurrentSize(size);
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border bg-background">
      <header className="flex items-center justify-between border-b bg-muted/30 px-6 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            推定プロフィール
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {savedFlash ? (
            <span className="text-brand-ink">✓ 保存しました</span>
          ) : null}
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-foreground/20 px-3 py-1 transition-colors hover:bg-foreground hover:text-background"
            >
              内容を確認・修正
            </button>
          ) : null}
        </div>
      </header>

      {!editing ? (
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
          <Field label="社名" value={currentDisplayName} />
          <Field label="業種" value={industryLabel} />
          <Field label="事業規模" value={sizeLabel} />
        </div>
      ) : (
        <div className="space-y-4 p-6">
          <FormField label="社名">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={255}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="業種">
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                {INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="事業規模">
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                {SIZE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存して確定'}
            </button>
          </div>
        </div>
      )}

      <footer className="flex items-center gap-3 border-t bg-muted/10 px-6 py-3 text-xs text-muted-foreground">
        <span>AI 推定信頼度</span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <span className="tabular-nums">{confidencePct}%</span>
        {confidencePct < 60 ? (
          <span className="ml-auto text-amber-700">低め — 手動で確認推奨</span>
        ) : null}
      </footer>

      {reasoning && !editing ? (
        <details className="border-t px-6 py-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">推定根拠</summary>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{reasoning}</p>
        </details>
      ) : null}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="bg-background px-6 py-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-base font-semibold">{value}</p>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
