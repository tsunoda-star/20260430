# Component Spec: Navigation

**Project**: security-checklist-tool / **Phase**: 2 / **Source**: design-system.yml

---

## App Shell 構成

```
┌──────────── Header (sticky top, h-14, bg white, border-b #E2E8F0) ────────┐
│  Logo │ Tenant Name │ Spacer │ Search │ Notifications │ Avatar (Menu) │
└─────────────────────────────────────────────────────────────────────────┘
┌─Sidebar (lg+)─┐ ┌── Main (flex-1, min-w-0) ───────────────────────────┐
│ Dashboard     │ │                                                       │
│ Assessments   │ │   Page content                                        │
│ Companies     │ │                                                       │
│ Settings      │ │                                                       │
│ ─────         │ │                                                       │
│ Admin         │ │                                                       │
│  ・Users      │ │                                                       │
│  ・Guidelines │ │                                                       │
└───────────────┘ └───────────────────────────────────────────────────────┘
```

## Breakpoint behavior

| Breakpoint | Sidebar |
|-----------|---------|
| < 768px | hidden, ハンバーガー → `Sheet` (left, 280px) |
| 768-1023px | アイコンのみ (rail, 64px), hover で popover |
| ≥ 1024px | 展開 (240px), ラベル付き |

## Active state

- 背景 `#F4F4ED`、左 4px の Deep Navy バー、テキスト `#0F2540` 600 weight

## Role-based items

| Item | owner | admin | editor | reviewer | viewer |
|------|:-----:|:-----:|:------:|:--------:|:------:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Assessments | ✓ | ✓ | ✓ | ✓ | ✓ (read) |
| Companies | ✓ | ✓ | ✓ | ✓ | ✓ (read) |
| Settings (Profile) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin/Users | ✓ | ✓ | × | × | × |
| Admin/Guidelines | ✓ | ✓ | × | × | × |

サーバー側の `requireRole` で二重ガード。クライアントで非表示でも信頼境界としない。

## Header items

- Logo: クリックで `/` (S1)
- Tenant Name: dropdown (複数所属時のみ切替表示)
- Search: `Cmd/Ctrl+K` で `Command` パレット
- Notifications: 未読バッジ (lucide Bell)
- Avatar: dropdown (Profile / Logout)

## Mobile bottom tabs (検討)

Phase 4 でユーザビリティ計測後に判断。初期は header + ハンバーガーのみ。

## A11y

- `<nav aria-label="Main navigation">` ランドマーク必須
- アクティブ要素に `aria-current="page"`
- skip link (`<a href="#main">本文へスキップ</a>`) ヘッダー直下

## Anti-patterns

- 3カラム (左サイドバー + メイン + 右サイドバー) 予測パターン
- ハンバーガーをデスクトップで採用
- 絵文字アイコン

## Test cases

- AC: 各ロールで適切なメニューのみ表示
- AC: `Esc` で mobile sheet close
- AC: skip link が最初のフォーカス
- AC: aria-current 正しく付与

<!-- END SECTION 1 -->
