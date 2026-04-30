# Component Library Configuration — security-checklist-tool

**Document ID**: DSGN-LIB-20260430
**Source**: docs/design/design-system.yml §components
**Phase**: 2 (Design)
**Created**: 2026-04-30

---

## 1. 採用ライブラリ

| 領域 | ライブラリ | バージョン目安 | 備考 |
|------|-----------|--------------|------|
| Component | **shadcn/ui** | 最新 | コピーベース、カスタマイズ自由 |
| CSS | **Tailwind CSS v4** | 4.x | utility-first、design-token連携 |
| Animation | **motion/react** | 11.x+ | 旧 framer-motion |
| Icons | **lucide-react** | 最新 | 線が細く清潔感、500+ |
| Forms | **react-hook-form + zod** | 最新 | 型安全 |
| Data Table | **TanStack Table v8** | 8.x | ヘッドレス |
| Charts | **Recharts** | 2.x | 進捗ドーナツ・棒グラフ |
| Toast | **sonner** | 1.x | shadcn/ui 標準 |

### 禁止 / 不採用

- 紫テーマの shadcn variant
- Material UI / Ant Design (デザイン哲学不一致)
- emoji-icons / fontawesome (lucide統一)

<!-- END SECTION 1 -->

## 2. shadcn/ui 採用コンポーネント一覧

### 確実に使う (Phase 4 で導入)

- `Button` (variant: primary / secondary / destructive / ghost)
- `Input`, `Textarea`, `Label`, `Form` (react-hook-form 連携)
- `Card`, `CardHeader`, `CardContent`, `CardFooter`
- `Table` (TanStack 連携)
- `Dialog` (確認ダイアログ)
- `Sheet` (右ペインドロワー、S4 項目詳細)
- `DropdownMenu`, `Select`, `Combobox`
- `Tooltip`
- `Badge` (Status: success/warning/danger/neutral)
- `Toast` / `Toaster` (sonner)
- `Tabs` (S5 設定画面)
- `Skeleton` (ローディング)
- `Progress` (分析プログレス、Recharts と併用)
- `Avatar` (担当者表示)
- `ScrollArea`
- `Separator`

### 必要に応じて

- `Calendar` (期限日選択)
- `Popover`
- `Command` (Cmd/Ctrl+K 検索パレット)
- `HoverCard`
- `Pagination`

<!-- END SECTION 2 -->

## 3. variant カスタマイズ方針

### Button

```tsx
// variants
primary:     "bg-[#0095C8] text-white hover:bg-[#0080AE] focus:ring-2 focus:ring-[#0095C8]/40"
secondary:   "border border-[#E2E8F0] text-[#0F172A] bg-white hover:bg-[#F4F4ED]"
destructive: "bg-[#DC2626] text-white hover:bg-[#B91C1C] (confirmation required)"
ghost:       "text-[#475569] hover:bg-[#F4F4ED]"

// sizes (touch target ≥ 44px)
sm: h-9 px-3   (mobileでは sm 不可)
md: h-11 px-4  (デフォルト)
lg: h-12 px-6
```

### Badge (Status)

```tsx
status:open            → bg-[#F4F4ED] text-[#475569] border-[#E2E8F0]
status:in_progress     → bg-[#7FCBE4]/20 text-[#0F2540] border-[#0095C8]/40
status:done            → bg-[#079173]/15 text-[#079173] border-[#079173]/30
status:not_applicable  → bg-[#F4F4ED] text-[#94A3B8]
priority:p0            → bg-[#DC2626] text-white
priority:p1            → bg-[#D97706] text-white
priority:p2            → bg-[#0095C8] text-white
priority:p3            → bg-[#64748B] text-white
```

### Card

- White surface (`bg-white`)
- Border `#E2E8F0` (1px)
- Hover時に shadow-sm 微小付与
- Radius `lg` (12px)

### Sheet (Drawer)

- 右ペイン、デスクトップのみ
- mobileでは `Dialog` full-screen に切替 (`useMediaQuery('(min-width: 1024px)')`)
- `motion/react` slideInFromRight 200ms

### Toast (sonner)

- 上端 or 右下
- 4秒自動消去
- success: Emerald / error: Coral Red / info: Sky Blue

<!-- END SECTION 3 -->

## 4. ディレクトリ構成 (Phase 4)

```
src/
├── components/
│   ├── ui/              # shadcn/ui base (auto-generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── domain/          # ドメイン特化 (本プロジェクト固有)
│   │   ├── url-input.tsx
│   │   ├── checklist-table.tsx
│   │   ├── item-detail-pane.tsx
│   │   ├── ai-chat-stream.tsx
│   │   ├── status-badge.tsx
│   │   └── progress-donut.tsx
│   └── layout/
│       ├── app-shell.tsx
│       ├── header.tsx
│       └── role-gate.tsx
├── styles/
│   ├── tokens.css       # CSS Variables (design-system.yml から生成)
│   └── globals.css
└── lib/
    ├── cn.ts            # clsx + tailwind-merge
    └── role.ts          # RBAC ヘルパー
```

<!-- END SECTION 4 -->

## 5. token 連携

`design-system.yml` から以下を自動生成 (Phase 4 開始時):

- `tailwind.config.ts` - colors / fontFamily / spacing / borderRadius
- `src/styles/tokens.css` - CSS Variables (`--color-accent: #0095C8` ...)
- `src/styles/tokens.ts` - TypeScript const (型補完用)

`cn()` ユーティリティを必ず使用 (`clsx` + `tailwind-merge`)。

<!-- END SECTION 5 -->

---

*CCAGI SDK Phase 2 — Component Library (DSGN-LIB-20260430)*
