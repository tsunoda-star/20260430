'use client';

import { useState } from 'react';

/**
 * Assessment 詳細から PDF / Excel / CSV をダウンロードするボタン群。
 * POST /api/v1/assessments/:id/exports でバイナリを取得して a[download] でファイルとして保存。
 */

const FORMATS = [
  { id: 'pdf', label: 'PDF', ext: 'pdf' },
  { id: 'xlsx', label: 'Excel', ext: 'xlsx' },
] as const;

interface Props {
  assessmentId: string;
}

export function ExportButtons({ assessmentId }: Props): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (format: 'pdf' | 'xlsx'): Promise<void> => {
    setBusy(format);
    setError(null);
    try {
      const res = await fetch(`/api/v1/assessments/${assessmentId}/exports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`http_${res.status}: ${t.slice(0, 160)}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      const filename = m?.[1]
        ? decodeURIComponent(m[1])
        : `assessment-${assessmentId}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">エクスポート:</span>
      {FORMATS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => download(f.id)}
          disabled={busy !== null}
          className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
        >
          {busy === f.id ? '生成中...' : f.label}
        </button>
      ))}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
