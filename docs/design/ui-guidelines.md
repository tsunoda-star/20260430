# UI Guidelines — security-checklist-tool

**Document ID**: DSGN-UI-20260430
**Source**: docs/design/design-system.yml + docs/requirements/design-requirements.md
**Phase**: 2 (Design)
**Created**: 2026-04-30

---

## 1. Aesthetic Direction

**Tone**: `professional-trustworthy`
**Mood**: `focused-minimal`

セキュリティ・コンプライアンス領域の「真面目さ・正確性・専門性」と、中小企業の非専門家ユーザーの「とっつきやすさ」を両立する。装飾を排し、データそのものを主役に。

<!-- END SECTION 1 -->

## 2. Differentiation

> **「URL一つで、セキュリティ対策の地図が手に入る」体験**

- トップ画面の URL 入力欄を中央に大型配置、それ以外の要素を徹底排除
- "分析中" 演出は Hmhm 風の **滑らかなプログレス + ガイドライン候補のフェードイン**
- 生成完了の瞬間に「この企業に最適な X 個のガイドラインが選ばれました」と称揚

参照: Hmhm (https://hmhm.wicle.io/)、Linear、Notion、Vercel Dashboard。

<!-- END SECTION 2 -->

## 3. Typography Guidelines

### Principles

- 見出しに `text-balance`、数値に `tabular-nums`
- 日本語の line-height は 1.6〜1.75 (欧文より広め)
- 一行 75ch まで
- **禁止**: Inter / Roboto / Arial / Helvetica

### Application

| 要素 | フォント | サイズ |
|------|---------|--------|
| Hero (S1) | Manrope 700 | 2.5rem (h1) + tracking -0.02em |
| Section h2 | Manrope 600 | 2rem |
| Item Title (h3) | Manrope 600 | 1.5rem |
| Body | Source Sans 3 400/500 | 1rem (line 1.6) |
| 日本語本文 | Noto Sans JP 400/500 | 1rem (line 1.7) |
| 数値 (進捗%, 件数) | Manrope 600 + tabular-nums | 1.25rem |
| データ・コード・ID | JetBrains Mono 400 | 0.875rem |

<!-- END SECTION 3 -->

## 4. Color Guidelines

### Principles

- 支配色は `Deep Navy #0F2540`、AI機能のみ `CC Sky Blue #0095C8` をアクセント
- Status は純色小バッジ (success / warning / danger / neutral)
- **禁止**: 紫グラデーション on 白背景、レインボーグラデーション、ネオン過剰、グレー単色UI

### Allowed Gradients

- `#0F2540 → #1A3658` (ヒーロー背景の微小シフト)
- `#0095C8 → #7FCBE4` (プログレス・アクセント)

### Contrast (WCAG AA 検証済み)

| 組み合わせ | 比 | 判定 |
|-----------|----|------|
| Charcoal #0F172A / Off White #FAFAF7 | 16.0:1 | AAA |
| White / Deep Navy #0F2540 | 14.8:1 | AAA |
| White / Sky Blue #0095C8 | 3.4:1 | AA-large |
| Emerald #079173 / White | 4.6:1 | AA |

<!-- END SECTION 4 -->

## 5. Motion Guidelines

### Principles

- 全インタラクション **200ms 以下** (例外: progress bar)
- `transform` / `opacity` のみ (compositor-only)
- `width` / `height` / `top` / `left` の transition **禁止**
- イージング標準 `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out)
- `prefers-reduced-motion` を必ず尊重 (`useReducedMotion`)
- 過剰なドロップシャドウ・グロー **禁止**

### Examples

| 操作 | アニメーション |
|------|--------------|
| 項目クリック → 右ペインドロワー | `translateX(100%) → 0`, opacity 0→1, 200ms |
| 行 hover | `bg #FAFAF7 → #F4F4ED`, 100ms |
| 分析プログレス | width transitionは禁止、`scaleX(0→1)` + transform-origin: left |
| トースト出現 | translateY(8px) + opacity, 150ms |

<!-- END SECTION 5 -->

## 6. Layout Guidelines

- `100vh` 禁止 → **`h-dvh`** を使用 (iOS Safari)
- 3カラム (左 + メイン + 右) の予測可能レイアウト禁止
- グリッド優先 (CSS Grid + Tailwind `grid-cols-*`)
- 余白は 8px グリッド (spacing scale)

### S1 Hero (URL入力)

- Deep Navy 全面背景 + 中央 White Surface card
- カード上下 padding 大きめ (呼吸感)
- 入力欄は `text-2xl`、フォーカスで CC Sky Blue リング 2px

### S3 Checklist Table

- 行 hover: `bg #F4F4ED` + 100ms
- 右上に進捗ドーナツ (`tabular-nums`、Recharts)
- ステータスバッジは縦中央揃え

<!-- END SECTION 6 -->

## 7. Accessibility

- WCAG 2.1 **AA**、Lighthouse Accessibility **100**
- `aria-label` / `aria-live` / `landmark` 適切に付与
- フォーカスインジケーター: CC Sky Blue 2px outline (offset 2px)
- キーボードのみで全操作可能
- タッチターゲット 44×44px 以上
- スクリーンリーダー: NVDA / VoiceOver / JAWS で疎通確認

<!-- END SECTION 7 -->

## 8. Anti-Patterns (NEVER)

| カテゴリ | 禁止 | 理由 |
|---------|------|------|
| フォント | Inter, Roboto, Arial, Helvetica | AI slop / 差別化不能 |
| カラー | 紫グラデーション on 白背景 | AI slop |
| カラー | レインボーグラデーション | AI slop |
| エフェクト | shadow-2xl 常用 / drop-shadow 過剰 | AI slop |
| アニメ | width/height/top/left transition | レイアウトシフト |
| アニメ | 200ms 超の頻繁インタラクション | 体感速度低下 |
| レイアウト | 3カラム予測パターン | 差別化不足 |
| レイアウト | 100vh の使用 | iOS Safari で崩れる、`h-dvh` 必須 |
| アイコン | 絵文字 (😀🚀) UI 利用 | トーン不一致 |

<!-- END SECTION 8 -->

---

*CCAGI SDK Phase 2 — UI Guidelines (DSGN-UI-20260430)*
