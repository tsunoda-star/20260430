/**
 * spec.md §4 / Cycle 4.3: Assessment ダッシュボード集計ロジック.
 * Prisma 依存ゼロ — 単体テスト容易化のため pure function.
 */

export type ItemStatus = 'open' | 'in_progress' | 'done' | 'not_applicable';

export interface DashboardItemRow {
  status: ItemStatus;
  /** YYYY-MM-DD 形式 (DB の Date を ISO に丸めた値) */
  dueDate: string | null;
  category: string;
}

export interface CategoryAggregate {
  category: string;
  total: number;
  done: number;
  byStatus: Record<ItemStatus, number>;
}

export interface DashboardSummary {
  totalCount: number;
  statusCounts: Record<ItemStatus, number>;
  /** 0..1 の完了率 (total=0 の場合 0) */
  completionRate: number;
  /** dueDate < today かつ status !== done の件数 */
  overdueCount: number;
  /** カテゴリ別 (total desc → name asc) */
  categories: CategoryAggregate[];
}

const ALL_STATUSES: ItemStatus[] = ['open', 'in_progress', 'done', 'not_applicable'];

/** 全 status 0 で初期化された Record */
function emptyStatusCounts(): Record<ItemStatus, number> {
  return { open: 0, in_progress: 0, done: 0, not_applicable: 0 };
}

/** YYYY-MM-DD → Date 比較用に millis */
function dateMs(yyyymmdd: string): number {
  return Date.parse(`${yyyymmdd}T00:00:00.000Z`);
}

export interface AggregateOptions {
  /** 'today' 判定の基準時刻 ISO. テスト用; 既定は new Date() */
  now?: Date;
}

/**
 * Assessment item 行から DashboardSummary を計算する。
 * Prisma クエリ結果を最小限の形に変換して呼び出す想定。
 */
export function aggregateDashboard(
  rows: ReadonlyArray<DashboardItemRow>,
  opts: AggregateOptions = {},
): DashboardSummary {
  const now = opts.now ?? new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const statusCounts = emptyStatusCounts();
  const categoryMap = new Map<string, CategoryAggregate>();
  let overdueCount = 0;

  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    if (
      row.dueDate &&
      row.status !== 'done' &&
      dateMs(row.dueDate) < todayMs
    ) {
      overdueCount += 1;
    }
    const cat = categoryMap.get(row.category) ?? {
      category: row.category,
      total: 0,
      done: 0,
      byStatus: emptyStatusCounts(),
    };
    cat.total += 1;
    cat.byStatus[row.status] += 1;
    if (row.status === 'done') cat.done += 1;
    categoryMap.set(row.category, cat);
  }

  const totalCount = rows.length;
  const completionRate = totalCount === 0 ? 0 : statusCounts.done / totalCount;

  const categories = Array.from(categoryMap.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.category.localeCompare(b.category, 'ja');
  });

  return {
    totalCount,
    statusCounts,
    completionRate,
    overdueCount,
    categories,
  };
}

export { ALL_STATUSES };
