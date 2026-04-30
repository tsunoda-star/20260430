import { cn } from '@/lib/utils';
import type { CategoryAggregate, ItemStatus } from '@/lib/server/dashboard';

/**
 * spec.md §4 + Cycle 4.3 ダッシュボード:
 * カテゴリ × ステータスの件数ヒートマップ.
 * Tailwind classes のみで実装 (外部チャート依存なし).
 *
 * - 列 (status) は固定順 open → in_progress → done → not_applicable
 * - 行 (category) は呼び出し側でソート済 (total desc / name asc)
 * - 数値は tabular-nums で整形 (design-requirements.md typography.principles)
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
  return (
    <div className={cn('overflow-auto', className)}>
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
}
