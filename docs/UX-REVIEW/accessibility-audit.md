# Accessibility Audit — WCAG AA チェックリスト

**Document ID**: UX-A11Y-20260430
**Phase**: 3 (Planning)
**Source**: docs/requirements/design-requirements.md §6 (品質基準), docs/design/spec.md §5-6, docs/design/ui-guidelines.md
**Project**: security-checklist-tool
**Created**: 2026-04-30

---

## 1. 基準と適合目標

| 項目 | 基準 |
|------|------|
| 準拠レベル | **WCAG 2.2 AA** (Phase 1 design-requirements 準拠) |
| Lighthouse Accessibility | **100** |
| コントラスト比 (本文) | **4.5:1 以上** |
| コントラスト比 (大文字) | **3.0:1 以上** |
| タッチターゲット | **44 × 44 px 以上** |
| キーボード操作 | **すべての操作が Tab + Enter で完結** |

---

## 2. WCAG 2.2 AA 適合チェックリスト

### 2.1 知覚可能 (Perceivable)

#### 1.1 代替テキスト

- [ ] **1.1.1** すべての非テキストコンテンツに `alt` または `aria-label` を付与
  - lucide-react アイコンには必ず `aria-label` または装飾用 `aria-hidden="true"`
  - チャート (S6 ダッシュボード) には Sr-only な data summary を併記

#### 1.3 適応可能

- [ ] **1.3.1** セマンティックなマークアップ (`<button>`, `<nav>`, `<main>`, `<table>`)
- [ ] **1.3.2** 意味のある順序 (Tab 順序が視覚順序と一致)
- [ ] **1.3.5** 入力目的の特定 (`autocomplete="email"` 等)

#### 1.4 判別可能

- [ ] **1.4.3** コントラスト比 (本文 4.5:1 / 大文字 3:1)
  - **検証済 (design-requirements.md §2.1)**:
    - Charcoal `#0F172A` on Off White `#FAFAF7` = 16.0:1 ✅ AAA
    - Mid Gray `#475569` on White `#FFFFFF` = 7.7:1 ✅ AAA
    - White on Deep Navy `#0F2540` = 14.8:1 ✅ AAA
    - White on CC Sky Blue `#0095C8` = 3.4:1 ⚠️ AA (大文字のみ) — **Phase 4 で大文字専用 / アイコンサイズ確認必要**
    - Emerald `#079173` on White = 4.6:1 ✅ AA
- [ ] **1.4.4** テキストサイズ変更 (200% まで読みやすい)
- [ ] **1.4.10** リフロー (320 CSS px 幅で水平スクロールなし)
- [ ] **1.4.11** 非テキストコントラスト (UI コンポーネント 3:1)
- [ ] **1.4.12** テキスト間隔 (line-height 1.5 / 段落間隔 2x)
- [ ] **1.4.13** ホバー/フォーカス時のコンテンツ (dismissable, hoverable, persistent)

### 2.2 操作可能 (Operable)

#### 2.1 キーボード

- [ ] **2.1.1** すべての機能がキーボード操作可能
- [ ] **2.1.2** キーボードトラップなし (Modal は Esc で抜けられる)
- [ ] **2.1.4** 文字キーショートカットの ON/OFF (Phase 4 で `?` ヘルプモーダル実装時)

#### 2.4 ナビゲーション

- [ ] **2.4.1** Skip to content リンク (`<a href="#main">`)
- [ ] **2.4.3** フォーカス順序が論理的
- [ ] **2.4.4** リンクの目的 (リンクテキストだけで判別可能、または aria-label 併用)
- [ ] **2.4.6** 見出し・ラベル (`<h1>` 〜 `<h6>` 階層)
- [ ] **2.4.7** フォーカス可視 (`:focus-visible` で 2px ring + Deep Navy)

#### 2.5 入力モダリティ

- [ ] **2.5.5** ターゲットサイズ 44x44 px (AA は 24x24, AAA は 44x44 — 本プロジェクトは AAA レベル)
- [ ] **2.5.7** ドラッグ操作の代替 (Phase 4 では DnD 未使用、Cycle 4.1 で証跡 DnD 実装時に必要)
- [ ] **2.5.8** ターゲット間隔 (チェックボックス間 8px 以上)

### 2.3 理解可能 (Understandable)

#### 3.1 読みやすさ

- [ ] **3.1.1** ページの言語 (`<html lang="ja">`)
- [ ] **3.1.2** 部分的な言語変更 (`<span lang="en">`)

#### 3.2 予測可能

- [ ] **3.2.1** フォーカス時に予期しない動作なし
- [ ] **3.2.2** 入力時に予期しないコンテキスト変化なし (フォーム送信は明示的トリガーのみ)
- [ ] **3.2.6** 一貫したヘルプ (グローバルナビにヘルプリンク)

#### 3.3 入力支援

- [ ] **3.3.1** エラーの特定 (`aria-invalid="true"` + `aria-describedby`)
- [ ] **3.3.2** ラベルまたは指示 (すべての input に `<label>` または `aria-label`)
- [ ] **3.3.3** エラーの修正提案 (URL 不正時「https:// で始まる URL を入力してください」)
- [ ] **3.3.7** 冗長な入力 (確認ダイアログでの再入力を最小化)

### 2.4 堅牢 (Robust)

- [ ] **4.1.2** 名前・役割・値 (すべての custom コンポーネントに ARIA)
- [ ] **4.1.3** ステータスメッセージ (`role="status"` / `role="alert"`)

---

## 3. 画面別チェックリスト

### S0 ログイン

- [ ] CC-Auth リダイレクト前に「OIDC 認証へ遷移します」アナウンス
- [ ] ロード状態 `aria-busy="true"`

### S1 トップ (URL入力)

- [ ] URL 入力 `<input type="url" aria-label="解析する URL" autocomplete="url">`
- [ ] 「分析開始」ボタン `<button type="submit">` (form の submit)
- [ ] 履歴一覧 `<nav aria-label="過去の分析">`

### S2 分析結果

- [ ] confidence バッジ `aria-label="信頼度: 高 (78)"`
- [ ] 警告バナー (confidence<50) `role="alert" aria-live="polite"`
- [ ] 修正フォーム `<fieldset><legend>`

### S3 シート一覧

- [ ] テーブル `<table role="table">` (or grid pattern)
- [ ] フィルタ `<aside aria-label="フィルタ">`
- [ ] ソート `<button aria-sort="ascending|descending|none">`

### S4 項目詳細

- [ ] 右ペインを `<aside>` または `<dialog>`
- [ ] AI チャット messages `role="log" aria-live="polite"`
- [ ] cancel ボタン `aria-label="AI回答の生成を中止"`

### S5 設定/出力

- [ ] エクスポート モーダル `<dialog role="dialog" aria-modal="true" aria-labelledby="...">` 
- [ ] 進捗 `role="progressbar" aria-valuenow aria-valuemax`

### S6 ダッシュボード

- [ ] チャート (Chart.js or Recharts) は data table を併記
- [ ] aria-label で要約 (例: 「完了率 67% / 期限超過 3件」)

### S7 ユーザー管理

- [ ] ロール変更 select `<label for="role">`
- [ ] 削除 確認 `<dialog>` (誤操作防止)

### S8 マスタ管理

- [ ] バージョン更新通知 `role="status"`
- [ ] CSV インポート `<input type="file" accept=".csv,.json">`

---

## 4. キーボードショートカット (Phase 4 提案)

| キー | 動作 | 画面 |
|------|------|------|
| `/` | URL 入力欄へフォーカス (S1) | S1 |
| `Cmd+K` | 検索/コマンドパレット | 全画面 |
| `Esc` | Modal 閉 / cancel | 全画面 |
| `j/k` | 行移動 (S3) | S3 |
| `Enter` | 行詳細を開く (S3 → S4) | S3 |
| `Cmd+S` | 保存 (S4) | S4 |
| `?` | ショートカットヘルプ | 全画面 |

**注**: `2.1.4` (文字ショートカットの ON/OFF) のため、設定画面で無効化可能にすること。

---

## 5. レスポンシブ × アクセシビリティ

| 観点 | モバイル要件 |
|------|------------|
| タッチターゲット | 44x44 px (AAA) — モバイルは特に重要 |
| テーブル → カード | S3 mobile では Card レイアウトに変換 |
| 5ロール権限マトリクス | モバイルでは 「自分のロール」のみハイライト表示 |
| アイコン専用ボタン | aria-label 必須 (画面サイズ縮小で text 削除時) |
| Pinch zoom | `<meta viewport>` で zoom 禁止しない |

---

## 6. 自動検証ツール (Phase 5/5.5 で利用)

| ツール | 検証内容 | 実行タイミング |
|-------|---------|--------------|
| Lighthouse CI | A11y スコア 100 | Phase 5.5 / `/test --mode e2e` |
| axe-core | WCAG 違反 0 | Phase 5 unit/integration |
| WAVE | 視覚的バリデーション | Phase 5.5 manual |
| Playwright + axe | E2E 内で自動チェック | Phase 5 e2e |
| color-contrast-analyzer | コントラスト 4.5:1 以上 | Phase 4 dev / Phase 5.5 |

---

## 7. テスト観点 (Phase 5 引き継ぎ)

| 観点 | テスト種 |
|------|---------|
| キーボードのみで全画面操作可能 | E2E |
| screen reader で disabled 理由が読み上げられる | E2E (manual) |
| Lighthouse Accessibility = 100 | Phase 5.5 |
| axe-core 違反 0 | Phase 5 unit |
| 5ロール × 主要操作 マトリクス E2E | Phase 5 e2e |
| モバイル touch target 44x44 | Phase 5 e2e (mobile viewport) |

---

## 8. Phase 4 への提案

| 提案 | Severity | 対応 Cycle |
|-----|---------|----------|
| 全 disabled ボタンに aria-describedby | High | Cycle 3.2 |
| Skip to content リンク | High | Cycle 1.2 |
| `:focus-visible` 2px ring + Deep Navy | High | Cycle 1.2 |
| キーボードショートカット `?` ヘルプ | Medium | Cycle 3.1 |
| White on Sky Blue の大文字限定使用 | High | Cycle 1.2 |
| モバイル table → card 変換 | High | Cycle 4.5 |
| Lighthouse CI 統合 | High | Cycle 1.1 (CI) |
| axe-core 統合 (vitest) | High | Cycle 1.1 (test) |

---

## 9. リスク・要観察事項

| リスク | 重要度 | 対応 |
|-------|-------|------|
| White on Sky Blue (3.4:1) を本文で使用すると AA 違反 | High | Phase 4 で大文字 + 18px 以上 限定 / または Sky Blue Light を併用しない |
| AI チャット streaming で screen reader が過剰読み上げ | Medium | aria-live="polite" + buffer (200ms) |
| Modal フォーカストラップ実装漏れ | Medium | shadcn/ui Dialog (Radix UI) を必ず使用 |
| カラーのみで状態区別 | High | アイコン (✅/⚠️/❌) を必ず併用 |
| Viewer の disabled 理由が分からない | High | tooltip 必須 (aria-describedby) |

<!-- END SECTION ALL -->
