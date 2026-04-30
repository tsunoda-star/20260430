import { History } from 'lucide-react';

/**
 * S1 トップ画面下部の「履歴から再開」エリア。
 *
 * Cycle 2.1 (本コミット) は空状態のみ実装。
 * Cycle 2.4 で GET /api/v1/companies?recent から取得した analyses 一覧に置換予定。
 */
export function HistoryEmptyState() {
  return (
    <section
      aria-labelledby="history-heading"
      className="mt-16 w-full max-w-2xl rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center"
    >
      <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <History className="size-5" aria-hidden="true" />
      </div>
      <h2
        id="history-heading"
        className="mt-3 font-heading text-h4 font-semibold tracking-tight text-foreground"
      >
        履歴から再開
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        過去に分析した会社はここに表示されます。
      </p>
    </section>
  );
}
