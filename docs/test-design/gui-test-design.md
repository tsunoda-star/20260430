# GUI Test Design — security-checklist-tool

**Document ID**: TEST-GUI-20260430
**Phase**: 2 (Design)
**Framework**: Playwright (Chromium / WebKit / Firefox) + axe-core
**Scope**: 画面遷移・レイアウト・アクセシビリティ・レスポンシブ

---

## 1. テストマトリクス

| Viewport | デバイス想定 |
|----------|------------|
| 360×640 | iPhone SE |
| 390×844 | iPhone 14 |
| 768×1024 | iPad portrait |
| 1024×768 | iPad landscape |
| 1280×800 | MacBook 13" (主要) |
| 1920×1080 | 外部モニタ |

5ロール × 6 viewport × 主要画面 をマトリクス化。

<!-- END SECTION 1 -->

## 2. 画面別シナリオ

### 2.1 S0 ログイン

| ID | シナリオ | 期待 |
|----|--------|------|
| G-L-01 | 未認証で `/` にアクセス | CC-Auth へリダイレクト |
| G-L-02 | OIDC callback 成功 | S1 トップへ |
| G-L-03 | session expired | ログイン画面 + トースト「再ログインしてください」 |

### 2.2 S1 トップ (URL入力)

| ID | シナリオ | 期待 |
|----|--------|------|
| G-S1-01 | URL入力フォームが画面中央、Hero h1 表示 | layout snapshot OK (1280×800) |
| G-S1-02 | 入力 + 「分析開始」 | S2 へ遷移、プログレスバー表示 |
| G-S1-03 | 不正URL | 入力下に Coral Red エラー、aria-invalid |
| G-S1-04 | Viewer role | 入力フィールド disabled + tooltip |
| G-S1-05 | 履歴から選択 | 直接 S3 (assessment) へ |

### 2.3 S2 分析結果・属性確認

| ID | シナリオ | 期待 |
|----|--------|------|
| G-S2-01 | 推定結果カード表示 (industry/size/b2x/pii) | 信頼度バッジ表示 |
| G-S2-02 | 属性手動修正 → 保存 | ガイドライン候補が再計算 |
| G-S2-03 | ガイドライン除外チェック → シート生成 | 除外結果が assessment に反映 |
| G-S2-04 | confidence < 50 | 「自動修正推奨」バッジ + フォーム強調 |

### 2.4 S3 チェックシート一覧

| ID | シナリオ | 期待 |
|----|--------|------|
| G-S3-01 | テーブルレンダリング (200項目) | <200ms 初期描画 |
| G-S3-02 | priority filter 適用 | URL クエリ更新 + 行数減少 |
| G-S3-03 | 行クリック → S4 ドロワー (右ペイン, lg+) | translateX 200ms |
| G-S3-04 | 行クリック (mobile) → S4 フルモーダル | h-dvh |
| G-S3-05 | J/K で行移動、Enter で詳細 | デスクトップのみ |
| G-S3-06 | 進捗ドーナツ tabular-nums | 数値整列確認 |
| G-S3-07 | Viewer role | 行 hover 無効、click でtoast「閲覧専用」 |
| G-S3-08 | 空状態 (フィルタ条件一致なし) | アイコン + メッセージ |

### 2.5 S4 項目詳細・AIチャット

| ID | シナリオ | 期待 |
|----|--------|------|
| G-S4-01 | ステータス変更 → 即座に保存表示 | optimistic update + rollback on error |
| G-S4-02 | メモ4001文字 | 4000文字でvalidation エラー |
| G-S4-03 | 期限日 過去日付 | エラー |
| G-S4-04 | AIチャット質問 → SSE ストリーミング表示 | tokenごとに UI 更新、cursor blink |
| G-S4-05 | Good/Bad 評価 | rating 即時反映、aria-pressed |
| G-S4-06 | Reviewer | status select disabled、note 追記のみ可能 |

### 2.6 S5 設定・出力

| ID | シナリオ | 期待 |
|----|--------|------|
| G-S5-01 | Excel エクスポートボタン | 202 → ポーリング → ダウンロード |
| G-S5-02 | PDF 200項目 | 15s 以内、layout崩れなし |
| G-S5-03 | Viewer role | Export ボタンのみ表示、プロフィール編集 disabled |

### 2.7 S7 ユーザー管理 (Admin)

| ID | シナリオ | 期待 |
|----|--------|------|
| G-S7-01 | 招待フォーム | email + role select (Admin/Editor/Viewer/Reviewer) |
| G-S7-02 | Editor role でアクセス | 403 ページ + 戻るボタン |

<!-- END SECTION 2 -->

## 3. 権限×画面マトリクス E2E

```typescript
// pseudo
const roles = ['owner','admin','editor','reviewer','viewer'];
const screens = ['S1','S2','S3','S4','S5','S6','S7','S8'];
test.each(crossProduct(roles, screens))(
  'role=%s screen=%s', async ({role, screen}, page) => {
    await loginAs(page, role);
    await page.goto(routeOf(screen));
    expect(await page.locator('[data-role-allowed]').count())
      .toEqual(EXPECTED[role][screen]);
  }
);
```

5 × 8 = **40 シナリオ**を生成。詳細マトリクスは `docs/design/spec.md §5.2`。

<!-- END SECTION 3 -->

## 4. レスポンシブ後退テスト

各 viewport で:

- S3: モバイル → カード型 / デスクトップ → テーブル切替
- S4: モバイル → フルモーダル / lg+ → 右ペイン
- ナビゲーション: ハンバーガー / rail / 固定サイドバー

`page.setViewportSize()` + visual regression (Playwright snapshot)。

<!-- END SECTION 4 -->

## 5. アクセシビリティ自動チェック

各画面で `axe-core` を実行:

- WCAG 2.1 AA violations 0件
- キーボードのみで全操作可能
- フォーカス可視 (CC Sky Blue 2px outline)
- aria-current / aria-label 必須箇所すべて

<!-- END SECTION 5 -->

## 6. 視覚回帰

- shadcn 主要コンポーネントの snapshot
- ダークモード (Phase 4以降) のCSS variables 切替確認

<!-- END SECTION 6 -->

## 7. 禁止パターン検出

E2E と並行して、ビルド成果物 (`.next/`) に対し grep:

- `Inter | Roboto | Arial | Helvetica` → 0件
- `bg-purple-` → 0件
- `100vh` → 0件 (h-dvh のみ)
- `shadow-2xl` 連続 → warning

<!-- END SECTION 7 -->

---

*CCAGI SDK Phase 2 — GUI Test Design (TEST-GUI-20260430)*
