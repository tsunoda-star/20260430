import { ShieldCheck } from 'lucide-react';
import { UrlInputForm } from '@/components/url-input-form';
import { HistoryEmptyState } from '@/components/history-empty-state';

/**
 * S1 トップ画面 — 一画面起点UX。
 * spec.md §5.1 / design-requirements.md hero design 準拠。
 */
export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-start px-4 pb-16 pt-24">
      <section className="w-full max-w-2xl text-center">
        <div
          className="mb-6 inline-flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent"
          aria-hidden="true"
        >
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-balance font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          URL一つで、
          <br className="hidden sm:inline" />
          セキュリティ対策の地図が手に入る
        </h1>
        <p className="mt-5 text-balance text-lg leading-relaxed text-muted-foreground">
          27ガイドライン横断のチェックシートを自動生成。
          IPA・METI・NIST など 27 のガイドラインから、必要な対策を抽出します。
        </p>

        <UrlInputForm />
      </section>

      <HistoryEmptyState />
    </main>
  );
}
