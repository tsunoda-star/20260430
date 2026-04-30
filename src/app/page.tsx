import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <section className="w-full max-w-2xl text-center">
        <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-balance font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          URL一つで、
          <br className="hidden sm:inline" />
          セキュリティ対策の地図が手に入る
        </h1>
        <p className="mt-6 text-balance text-lg leading-relaxed text-muted-foreground">
          27ガイドライン横断のチェックシートを自動生成。
          <br />
          IPA・METI・NIST など 27 のガイドラインから、あなたの会社に必要な対策を抽出します。
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ variant: 'default', size: 'lg' }))}
          >
            ログインして始める
          </Link>
          <Link
            href="https://github.com/tsunoda-star/20260430"
            target="_blank"
            rel="noreferrer noopener"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          >
            GitHub
          </Link>
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          Phase 4 / Wave 1 — 基盤実装中。Wave 2 で URL 投入フローを実装予定。
        </p>
      </section>
    </main>
  );
}
