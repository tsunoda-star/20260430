import { ShieldCheck } from 'lucide-react';
import { UrlInputForm } from '@/components/url-input-form';
import { HistoryEmptyState } from '@/components/history-empty-state';

/**
 * S1 トップ画面 — 一画面起点UX。
 * spec.md §5.1 / design-requirements.md hero design 準拠。
 */
export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-start px-4 pb-20 pt-20">
      <section className="w-full max-w-2xl text-center">
        <div
          className="mb-6 inline-flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink"
          aria-hidden="true"
        >
          <ShieldCheck className="size-6" />
        </div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-ink">
          AI Security Checklist
        </p>
        <h1 className="mt-3 text-balance font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          URL一つで、
          <br className="hidden sm:inline" />
          セキュリティ対策の地図が手に入る
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
          IPA・METI・NIST など 27 のガイドライン横断で、
          あなたの会社に必要な対策だけを自動で抽出します。
        </p>

        <UrlInputForm />

        <ul className="mt-10 grid grid-cols-3 gap-2 text-center text-xs md:gap-4">
          <Stat number="27" label="ガイドライン" />
          <Stat number="500+" label="チェック項目" />
          <Stat number="数十秒" label="で結果が出ます" />
        </ul>
      </section>

      <div className="w-full max-w-2xl">
        <HistoryEmptyState />
      </div>
    </main>
  );
}

function Stat({ number, label }: { number: string; label: string }): JSX.Element {
  return (
    <li className="rounded-xl border bg-background px-3 py-4">
      <p className="font-heading text-2xl font-bold tabular-nums text-brand-ink md:text-3xl">
        {number}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </li>
  );
}
