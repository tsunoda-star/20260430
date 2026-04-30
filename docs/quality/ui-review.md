# UI Quality Review — Phase 5.5 / Cycle 5.5.2

**Project**: security-checklist-tool
**Generated**: 2026-04-30
**Scope**: `src/` 配下 — 16 client components + UI primitives + globals.css
**Reference**: `docs/requirements/design-requirements.md` / `docs/design/ui-guidelines.md` / `docs/design/responsive-guidelines.md`
**Verdict**: ✅ **PASS**

---

## 1. サマリ

| カテゴリ | 結果 | 備考 |
|---------|:---:|------|
| 1. Tech Stack | ✅ PASS | Tailwind v3 / motion/react / cn / radix-ui 揃う |
| 2. Accessibility | ✅ PASS | aria-* 46 件 / role 5 件 / sr-only 2 件 / prefers-reduced-motion 対応 |
| 3. Animation | ✅ PASS | duration-base (200ms) 統一 / layout transition 0 件 |
| 4. Typography | ✅ PASS | text-balance 4 ファイル / tabular-nums 5 ファイル / **禁止フォント 0 件** |
| 5. Layout | ✅ PASS | h-dvh 使用 / z-50 のみ / **紫グラデ 0 件** |
| 6. Performance | ✅ PASS | backdrop-blur-sm 1 箇所のみ / will-change 0 件 |

**Lighthouse 実機計測** は dev server + 実 DB が必要なため、Phase 7 デプロイ後に `.lighthouserc.json` 経由で計測予定。

---

## 2. 詳細

### 2.1 Tech Stack — design-requirements.md 準拠

| 要件 | 確認 | 場所 |
|------|:---:|------|
| Tailwind config (design-system.yml 派生) | ✅ | `tailwind.config.ts` (Cycle 4.5 で WCAG 検証済) |
| PostCSS / autoprefixer | ✅ | `postcss.config.mjs` |
| globals.css に `@tailwind base/components/utilities` | ✅ | `src/app/globals.css` |
| motion/react 採用 | ✅ | `url-input-form.tsx`, `progress-stream.tsx` |
| `cn` utility | ✅ | `src/lib/utils.ts` |
| radix-ui プリミティブ | ✅ | `@radix-ui/react-dialog`, `react-label`, `react-slot` |
| shadcn/ui コンポーネント | ✅ | `src/components/ui/` (button/card/dialog/form/input/label/navigation/table) |
| sonner (toast) | ✅ | `src/app/layout.tsx` |
| lucide-react (アイコン統一) | ✅ | 全 client component で使用 |

### 2.2 Accessibility (WCAG 2.1 AA 目標)

| 要件 | 確認 | 数 |
|------|:---:|---:|
| `aria-label` / `aria-labelledby` / `aria-describedby` | ✅ | 17 |
| `aria-hidden` (装飾アイコン) | ✅ | 多数 |
| `aria-invalid` / `aria-disabled` / `aria-busy` / `aria-live` | ✅ | 6+ |
| `role="status"` / `role="img"` 等 | ✅ | 5 |
| `<Label htmlFor>` 紐付け | ✅ | `url-input-form.tsx` (`sr-only` で視覚非表示) |
| `<table>` semantic (scope=row/col) | ✅ | `category-heatmap.tsx`, `role-matrix-display.tsx` |
| `prefers-reduced-motion` | ✅ | `globals.css:31` でアニメーション 0.01ms に縮退 |
| Focus ring (`:focus-visible`) | ✅ | tokens.css `--ring` + design-system 準拠 |
| 44px+ タッチターゲット (主要 CTA) | ✅ | ExportCta (h-12) / submit ボタン (h-12) / button size="lg" (h-11) |
| WCAG コントラスト 4.5:1 | ✅ | `src/lib/a11y/contrast.ts` で Deep Navy on Off-White ≥ 4.5 を assertion 検証済み (Cycle 4.5) |

### 2.3 Animation (motion/react)

| ルール | 確認 |
|--------|:---:|
| Tailwind `transition-*` の duration は `duration-base` (200ms) で統一 | ✅ button/card/dialog/input/navigation/table/export-cta すべて使用 |
| motion/react `transition.duration` は 0.2s 以下 | ✅ 全 3 箇所で 0.2 |
| `ease: [0.16, 1, 0.3, 1]` (design-system motion.easing.out) | ✅ 全 motion 箇所で適用 |
| Compositor props (transform / opacity) のみ | ✅ width / height / top / left の transition 0 件 |
| アニメーションは 200ms 以内 | ✅ 全 200ms |

### 2.4 Typography

| ルール | 確認 |
|--------|:---:|
| **禁止フォント (Inter / Roboto / Arial / Helvetica) 0 件** | ✅ font-family value として 0 件 (typography.css のコメント言及のみ) |
| `text-balance` 採用 (見出し) | ✅ 4 ファイル: page.tsx / typography.css / card.tsx / dialog.tsx |
| `tabular-nums` 採用 (数値表示) | ✅ 5 ファイル: progress-donut / master-update-banner / category-heatmap / table / typography.css |
| 見出し: Manrope (design-requirements.md) | ✅ `--font-heading: Manrope` (layout.tsx) |
| 本文: Source Sans 3 + Noto Sans JP | ✅ `--font-body` + `--font-jp` |
| JP body line-height ≥ 1.7 | ✅ typography.css `:lang(ja) body, body { line-height: 1.7 }` |

### 2.5 Layout

| ルール | 確認 |
|--------|:---:|
| `h-dvh` / `min-h-dvh` (iOS Safari 対応) | ✅ layout.tsx + page.tsx |
| z-index は 50 のみ (modal overlay 標準) | ✅ z-50 のみ。マジックナンバー無し |
| **紫グラデーション on 白 0 件** | ✅ `bg-gradient-to-*` も `from-purple-*` も検出なし |
| グラデーションの濫用 0 件 | ✅ 検出なし |
| ダークモード対応 (`.dark`) | ✅ tokens.css にダーク用変数定義済 |

### 2.6 Performance

| ルール | 確認 |
|--------|:---:|
| backdrop-blur 使用は最小限 | ✅ `dialog.tsx:25` の `backdrop-blur-sm` 1 箇所のみ (オーバーレイ標準) |
| 他 `blur-*` クラス使用 | ✅ 0 件 |
| `will-change` 使用 | ✅ 0 件 (デフォルト依存; compositor props のみで自動最適化) |
| サーバーコンポーネント優先 | ✅ クライアント (`'use client'`) は必要箇所のみ (16 components のうち 8) |
| Largest font weight bundle | ✅ Manrope/Source Sans/Noto は `next/font/google` の `display: swap` |

### 2.7 レスポンシブ (responsive-guidelines.md)

| ルール | 確認 |
|--------|:---:|
| ブレークポイント (sm/md/lg/xl/2xl) | ✅ tailwind.config.ts の design-system.yml 派生 |
| モバイル table → card 変換 | ✅ `ResponsiveTable` (Cycle 4.5) で `category-heatmap`, `role-matrix-display` が対応 |
| 5 ロール権限マトリクスのモバイル簡略表示 | ✅ `role-matrix-display.tsx` (chip + line-through) |
| viewport meta + theme-color | ✅ `layout.tsx` Viewport export |

---

## 3. 既知の改善余地 (情報レベル)

| 項目 | 内容 | 優先度 |
|------|------|--------|
| PDF 日本語フォント埋め込み | `pdf.ts` で Helvetica fallback. 漢字が正しく描画されない可能性 | Low (Cycle 4.5 で言及済み — Phase 6 / 7 で対応推奨) |
| `eslint-plugin-tailwindcss` の shorthand 警告 (h-10 w-10 → size-10) | `button.tsx`, `dialog.tsx` の 2 箇所 | Low (UI primitive、互換性懸念で保留) |
| Lighthouse 実機計測 | 未実施 (dev server + DB 起動必要) | Phase 7 で実施 |

これらは ゲート判定に影響しない (lenient policy)。strict policy では PDF 日本語フォントの解消が望ましい。

---

## 4. ゲート判定

| Policy | 判定基準 | 結果 |
|--------|---------|:---:|
| **lenient** (本フェーズ採用) | Critical=0 のみ | ✅ **PASS** |
| standard (staging) | Critical=0 + Tech Stack/A11y/Anim 全 PASS | ✅ PASS |
| strict (prod) | 上記 + Lighthouse Performance ≥90 / Accessibility=100 + PDF 日本語対応 | 🟡 Phase 7 で再評価 |

---

## 5. 採用された防御層 (再確認)

| 層 | 実体 |
|---|------|
| WCAG コントラスト計算 | `src/lib/a11y/contrast.ts` (Cycle 4.5) |
| 5 ロール permission matrix | `src/lib/server/permissions.ts` (Cycle 3.2) |
| Viewer 専用フロー UX | `WhyDisabledBanner` + `ExportCta` + `ViewerRouteGate` (Cycle 3.3) |
| Disabled action 視覚分離 | `DisabledActionButton` (低彩度 + tooltip) |
| Tenant 越え参照防止 | Prisma `$extends` `tenant-guard` (Cycle 3.2) |
| Markdown XSS サニタイズ | `sanitizeAiChatMarkdown` (Cycle 3.1) |
| SSRF deny-by-default | `safeFetch` + `BLOCK_HOSTS` + `isPrivateOrReservedIP` (Cycle 2.2) |
| LLM degraded fallback | `estimate` / `streamAiChat` + `ruleBasedEstimate` (Cycle 2.3 / 3.1) |

---

## 付録: スキャン実行コマンド (再現可能)

```bash
# Tech Stack
ls tailwind.config.ts postcss.config.mjs src/app/globals.css
grep -rln "from 'motion/react'" src/

# A11Y
grep -roEn "aria-(label|labelledby|describedby|hidden|live|busy|invalid)=" \
  src/components src/app --include='*.tsx' | wc -l

# Animation
grep -rEn "transition.*(width|height|top|left|right|bottom)\b" \
  src/ --include='*.tsx' --include='*.ts' --include='*.css'

# Typography (forbidden fonts strict)
grep -rEn "font-family.*\b(Inter|Roboto|Arial|Helvetica)\b" \
  src/ tailwind.config.ts

# Layout (forbidden gradients)
grep -rEn "from-(purple|violet|fuchsia)|to-(purple|violet|fuchsia)" \
  src/ --include='*.tsx' --include='*.css'

# Performance
grep -rEn "backdrop-blur|will-change" \
  src/ --include='*.tsx' --include='*.css'
```

---
*Phase 5.5 / Cycle 5.5.2 — UI Quality Review (security-checklist-tool)*
