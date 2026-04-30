# Component Spec: Table (Checklist)

**Project**: security-checklist-tool / **Phase**: 2 / **Source**: design-system.yml

---

## Implementation

- TanStack Table v8 ヘッドレス + shadcn `Table`
- 仮想化: TanStack Virtual (200項目超で有効化)

## Columns (S3 一覧)

| Col | Header | Width | Align | Sortable |
|-----|--------|-------|-------|----------|
| priority | P | 48px | center | ✓ |
| category | カテゴリ | 160px | left | ✓ |
| title | 対策 | flex | left | ✗ |
| status | ステータス | 120px | left | ✓ |
| assignee | 担当 | 140px | left | ✓ |
| due_date | 期限 | 120px | right (`tabular-nums`) | ✓ |

## Row interactions

- hover: bg `#F4F4ED`, 100ms
- click: 右ペイン (S4) を開く (`Sheet` slideInFromRight 200ms)
- keyboard: J/K で選択行移動、Enter で開く
- Viewer ロール: hover無効・click 無効化 + tooltip "閲覧専用"

## Filtering

- 左サイドバー: priority (multi), status (multi), category (multi), assignee (single)
- mobileではfilter Sheet (左 slideInFromLeft)

## Empty state

- アイコン (lucide `FolderSearch`) + 説明 "条件に一致する項目がありません"

## Anti-patterns

- 横スクロール常時表示 (mobileではcardレイアウトに切替)
- `<table>` 内に div 過多 (semantic HTML を保つ)

## Test cases

- AC: 200項目のレンダリングが 16ms 以内 (60fps)
- AC: フィルタ適用で URL クエリ更新 (deep link)
- AC: keyboard 全操作可能
- AC: aria-rowindex / aria-colindex 適切付与

<!-- END SECTION 1 -->
