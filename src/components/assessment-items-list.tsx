'use client';

import { useMemo, useState } from 'react';
import { AssessmentItemDrawer } from './assessment-item-drawer';

/**
 * Assessment 詳細ページの項目一覧。
 * - カテゴリ別フィルタ + ステータス別フィルタ
 * - 各項目クリックでドロワー (詳細 + メモ + AI 質問) を開く
 * - ステータスは項目内のセグメント Boolean で直接更新
 */

export type ItemStatus = 'open' | 'in_progress' | 'done' | 'not_applicable';

export interface AssessmentItemView {
  id: string;
  status: ItemStatus;
  note: string;
  dueDate: string | null;
  controlItem: {
    id: string;
    title: string;
    category: string;
    priority: number;
    description: string | null;
    guidelineCode: string;
    guidelineName: string;
  };
}

interface Props {
  items: AssessmentItemView[];
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  open: '未着手',
  in_progress: '対応中',
  done: '完了',
  not_applicable: '対象外',
};

const STATUS_DOT: Record<ItemStatus, string> = {
  open: 'bg-muted-foreground/40',
  in_progress: 'bg-amber-500',
  done: 'bg-brand',
  not_applicable: 'bg-muted-foreground/20',
};

export function AssessmentItemsList({ items: initialItems }: Props): JSX.Element {
  const [items, setItems] = useState<AssessmentItemView[]>(initialItems);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.controlItem.category);
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && it.controlItem.category !== categoryFilter) return false;
      return true;
    });
  }, [items, statusFilter, categoryFilter]);

  const updateLocal = (id: string, patch: Partial<AssessmentItemView>): void => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const openItem = items.find((it) => it.id === openId) ?? null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">ステータス</span>
          {(['all', 'open', 'in_progress', 'done', 'not_applicable'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={
                'rounded-full px-3 py-1 transition-colors ' +
                (statusFilter === s
                  ? 'bg-brand text-white'
                  : 'bg-muted hover:bg-muted/80')
              }
            >
              {s === 'all' ? '全て' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">カテゴリ</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? '全て' : c}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} / {items.length} 件
        </p>
      </div>

      <ul className="divide-y rounded-lg border">
        {filtered.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => setOpenId(it.id)}
              className="flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
            >
              <span
                aria-label={STATUS_LABEL[it.status]}
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[it.status]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    {it.controlItem.guidelineCode}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {it.controlItem.category}
                  </span>
                  {it.controlItem.priority >= 80 ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                      重要
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium">{it.controlItem.title}</p>
                {it.note ? (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    📝 {it.note}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {STATUS_LABEL[it.status]}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            条件に一致する項目がありません
          </li>
        ) : null}
      </ul>

      {openItem ? (
        <AssessmentItemDrawer
          item={openItem}
          onClose={() => setOpenId(null)}
          onUpdate={updateLocal}
        />
      ) : null}
    </section>
  );
}
