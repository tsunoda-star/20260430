# Responsive Guidelines — security-checklist-tool

**Document ID**: DSGN-RES-20260430
**Source**: docs/design/design-system.yml §responsive + design-requirements.md §5
**Phase**: 2 (Design)
**Created**: 2026-04-30

---

## 1. 設計戦略

**モバイルファースト** ─ 360px 幅から設計し、breakpoint で段階的に機能拡張。

主要利用シーンは **デスクトップ業務利用** (≥ 1024px) のため、モバイルでは「閲覧・ステータス更新中心」の機能サブセットに限定する。新規 URL 分析・シート生成はモバイルで非推奨 (UI 警告表示)。

<!-- END SECTION 1 -->

## 2. ブレークポイント (Tailwind v4 準拠)

```yaml
base:  "0px"     # モバイル: 360px〜639px
sm:    "640px"  # 大きめモバイル / 縦タブレット
md:    "768px"  # タブレット
lg:    "1024px" # デスクトップ (主要利用)
xl:    "1280px" # 大型デスクトップ
2xl:   "1536px" # 超大型 / 外部モニタ
```

設計の重心は `lg` (1024px+)。

<!-- END SECTION 2 -->

## 3. 画面別レイアウト切替

| 画面 | モバイル (< 768px) | タブレット (768-1023px) | デスクトップ (≥ 1024px) |
|------|------------------|------------------------|-----------------------|
| S1 トップ (URL入力) | 縦スタック、入力フォーム中央 | 同左 (余白拡大) | 同左 (余白広め、ヒーロー大型) |
| S2 分析結果・属性確認 | 縦スタック、属性→ガイドライン順 | 2カラム | 2カラム (属性 / ガイドライン) |
| S3 チェックシート一覧 | フィルタ折りたたみ (Drawer)、リスト表示 | サイドフィルタ + リスト | サイドフィルタ + テーブル |
| S4 項目詳細・AIチャット | フルモーダル (`Dialog`) | フルモーダル | 右ペインドロワー (`Sheet`) |
| S5 設定・出力 | 縦スタック | 縦スタック | 2カラム (左:設定 / 右:Export) |
| S6 ダッシュボード | 縦スタック | 2カラム | 3カラム (集計 / 期限超過 / 担当別) |

<!-- END SECTION 3 -->

## 4. タッチターゲット & 入力

- 全インタラクティブ要素 **44 × 44px 以上** (WCAG 2.5.5 / 2.5.8)
- iOS Safari の hit-area 拡張対応 (`-webkit-tap-highlight-color: transparent` + 透明 padding)
- フォームフィールドは `font-size >= 16px` (iOS の auto-zoom 抑止)
- 入力フィールド間の間隔は最低 8px

<!-- END SECTION 4 -->

## 5. ビューポート / 高さ単位

- **`100vh` 禁止** → `h-dvh` (動的ビューポート) を使用
- iOS Safari のアドレスバー伸縮対応
- モーダルの max-height は `h-[100dvh]` ベース

<!-- END SECTION 5 -->

## 6. キーボードショートカット (デスクトップのみ)

| キー | 動作 |
|------|------|
| `Cmd/Ctrl + K` | 検索パレット (shadcn `Command`) |
| `J / K` | 項目リストの上下移動 |
| `Enter` | 選択行の詳細を開く |
| `Esc` | モーダル / ドロワーを閉じる |
| `?` | ショートカット一覧モーダル |

タブレット/モバイルでは無効。`useMediaQuery('(min-width: 1024px)')` でガード。

<!-- END SECTION 6 -->

## 7. ナビゲーション

| Breakpoint | パターン |
|-----------|---------|
| < 768px | ハンバーガー → Sheet (左) |
| 768-1023px | 折り畳みサイドバー (アイコンのみ表示、hover で展開) |
| ≥ 1024px | 固定サイドバー (展開、240px幅) |

ヘッダーは全 breakpoint で固定 (sticky top-0)、テナント名 + ユーザー avatar + 通知ベル。

<!-- END SECTION 7 -->

## 8. テスト方針

| Viewport | デバイス想定 | テスト |
|----------|------------|--------|
| 360×640 | iPhone SE | Playwright mobile |
| 390×844 | iPhone 14 | Playwright mobile |
| 768×1024 | iPad portrait | Playwright tablet |
| 1024×768 | iPad landscape | Playwright tablet |
| 1280×800 | MacBook 13" | Playwright desktop (primary) |
| 1920×1080 | 外部モニタ | Playwright desktop |

レスポンシブ後退テストを Phase 5 に組込み (gui-test-design.md 参照)。

<!-- END SECTION 8 -->

---

*CCAGI SDK Phase 2 — Responsive Guidelines (DSGN-RES-20260430)*
