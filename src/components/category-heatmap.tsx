import { cn } from '@/lib/utils';
import type { CategoryAggregate, ItemStatus } from '@/lib/server/dashboard';
import { ResponsiveTable } from './responsive-table';

/**
 * spec.md §4 + Cycle 4.3 ダッシュボード + Cycle 4.5 レスポンシブ:
 * カテゴリ × ステータスの件数ヒートマップ.
 * Tailwind classes のみで実装 (外部チャート依存なし).
 *
 * - 列 (status) は固定順 open → in_progress → done → not_applicable
 * - 行 (category) は呼び出し側でソート済 (total desc / name asc)
 * - 数値は tabular-nums で整形 (design-requirements.md typography.principles)
 * - モバイル: ResponsiveTable で table → card 切替
 */

const STATUS_ORDER: ItemStatus[] = ['open', 'in_progress', 'done', 'not_applicable'];

const STATUS_LABEL_JA: Record<ItemStatus, string> = {
  open: '未着手',
  in_progress: '対応中',
  done: '完了',
  not_applicable: '対象外',
};

export interface CategoryHeatmapProps {
  categories: ReadonlyArray<CategoryAggregate>;
  className?: string;
}

/** count の強度を 0..1 に正規化して bg opacity に反映 */
function intensityClass(count: number, max: number): string {
  if (max === 0 || count === 0) return 'bg-secondary';
  const ratio = count / max;
  if (ratio > 0.75) return 'bg-accent text-accent-foreground';
  if (ratio > 0.5) return 'bg-accent/70 text-accent-foreground';
  if (ratio > 0.25) return 'bg-accent/40 text-foreground';
  return 'bg-accent/20 text-foreground';
}

export function CategoryHeatmap({ categories, className }: CategoryHeatmapProps): JSX.Element {
  const max = categories.reduce((m, c) => Math.max(m, c.total), 0);
  if (categories.length === 0) {
    return (
      <p className={cn('rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground', className)}>
        カテゴリ別データがまだありません
      </p>
    );
  }
  const tableView = (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm" aria-label="カテゴリ別進捗">
        <thead>
          <tr>
            <th className="bg-secondary/40 px-3 py-2 text-left font-semibold text-foreground">
              カテゴリ
            </th>
            {STATUS_ORDER.map((s) => (
              <th
                key={s}
                scope="col"
                className="bg-secondary/40 px-3 py-2 text-center font-semibold text-foreground"
              >
                {STATUS_LABEL_JA[s]}
              </th>
            ))}
            <th className="bg-secondary/40 px-3 py-2 text-center font-semibold text-foreground">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.category} className="border-b border-border last:border-b-0">
              <th
                scope="row"
                className="px-3 py-2 text-left font-medium text-foreground"
              >
                {c.category}
              </th>
              {STATUS_ORDER.map((s) => {
                const n = c.byStatus[s];
                return (
                  <td
                    key={s}
                    className={cn(
                      'px-3 py-2 text-center tabular-nums',
                      intensityClass(n, max),
                    )}
                  >
                    {n}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-center font-semibold tabular-nums">{c.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // モバイル時のカード列挙 — 1 カードに 1 カテゴリ + ステータス内訳
  const cardView = (
    <ul className="space-y-3" aria-label="カテゴリ別進捗 (モバイル)">
      {categories.map((c) => (
        <li
          key={c.category}
          className="rounded-md border border-border bg-card p-3 text-card-foreground shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium text-foreground">{c.category}</p>
            <p className="text-sm font-semibold tabular-nums">合計 {c.total}</p>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {STATUS_ORDER.map((s) => {
              const n = c.byStatus[s];
              return (
                <div
                  key={s}
                  className={cn(
                    'flex items-center justify-between rounded-sm px-2 py-1',
                    intensityClass(n, max),
                  )}
                >
                  <dt>{STATUS_LABEL_JA[s]}</dt>
                  <dd className="font-medium tabular-nums">{n}</dd>
                </div>
              );
            })}
          </dl>
        </li>
      ))}
    </ul>
  );

  return <ResponsiveTable className={className} table={tableView} cards={cardView} />;
}
