# Viewer 専用エクスポートフロー — UX 設計

**Document ID**: UX-VEF-20260430
**Phase**: 3 (Planning)
**Source**: docs/design/spec.md §5-6 (5ロール権限マトリクス)
**Project**: security-checklist-tool
**Created**: 2026-04-30

---

## 1. 背景・問題意識

Phase 2 spec.md で Viewer は **エクスポート専用** と定義された (Phase 1 §3.6 US-AU04 互換)。一般的な BtoB SaaS の Viewer ロールは「読み取り専用」だが、本プロダクトでは **取引先審査担当 / 経営層** が短時間で必要な情報を抜き出す用途が想定される。エクスポートを最優先動線とする UX が必要。

### 想定ユーザー

| 想定ユーザー | 利用目的 | 使用頻度 |
|-------------|---------|---------|
| 取引先審査担当 (例: 病院・親会社) | 自社向けに提出されたチェックシートを PDF で受領 | 月1〜2回 |
| 経営層 (CEO/CIO) | 進捗を月次でハイレベルに把握 | 月1回 |
| 監査法人 / 外部コンサル | 監査証跡を CSV で抽出 | 四半期 |

---

## 2. 動線設計

### 2.1 主動線 (推奨フロー)

```
S0 ログイン
    ↓
[Viewer 検出]
    ↓
S1' Viewer ホーム (S1 のリストレイアウト変形)
    │
    ├── 過去Assessment一覧 (Card layout)
    │   └── 「PDFエクスポート」CTA を Card 上に配置
    │
    ├── [全Assessment一覧] → S3 (read-only + export ボタン)
    │
    └── [プロフィール] → 標準 dropdown
```

### 2.2 二次動線 (詳細確認後にエクスポート)

```
S1' → S3 (read-only) → 行クリック → S4 (read-only) → S3 戻る → エクスポート
```

### 2.3 禁止動線

```
S1' → URL入力 (disabled — クリック不可)
S3 → ステータス変更 (ボタン非表示)
S4 → メモ編集 (input disabled)
```

---

## 3. UI コンポーネント設計

### 3.1 Viewer 検出と権限バナー

ログイン直後、グローバル領域に **権限差バナー** を常時表示:

```tsx
<Banner variant="info" dismissible>
  <Icon name="eye" />
  あなたは <strong>Viewer</strong> です — 閲覧とエクスポートが可能です
  <Link href="/help/role">権限について</Link>
</Banner>
```

仕様:
- 初回ログインから3回まで表示、以降 dismiss 後は localStorage で抑制
- グローバルナビ直下、コンテンツ上部に固定
- 配色: Background Subtle `#F4F4ED` / Text Primary `#0F172A`

### 3.2 S1' Viewer ホーム

通常 S1 (URL入力中央配置) ではなく、**Assessment リスト中心** のレイアウト:

```
┌──────────────────────────────────────────┐
│ あなたが閲覧・エクスポート可能な評価シート │
├──────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐  │
│ │ 2026Q2 医療向け │ │ 2026Q1 製造向け │  │
│ │ 進捗: 67%       │ │ 進捗: 100%      │  │
│ │ [📄 PDF] [📊 XLS]│ │ [📄 PDF] [📊 XLS]│  │
│ └─────────────────┘ └─────────────────┘  │
└──────────────────────────────────────────┘
```

設計仕様:
- Card は shadcn/ui Card (component-specs/card.md 準拠)
- エクスポート CTA は Card 内に直接配置 (1クリックでエクスポート開始)
- フォーマット選択は Modal で (PDF / Excel / CSV ラジオ + 「ロゴ埋め込み」チェック)

### 3.3 S1 URL 入力欄 (Viewer の場合)

```tsx
<form>
  <Input
    placeholder="URL を入力..."
    disabled={true}
    aria-disabled="true"
    aria-describedby="url-disabled-reason"
  />
  <Tooltip id="url-disabled-reason">
    Viewer の権限では URL 投入はできません。
    Editor 以上の権限が必要です。Admin に依頼してください。
  </Tooltip>
</form>
```

### 3.4 S3 シート一覧 (Viewer)

- 編集系ボタン (削除/ステータス変更/メモ) は **非表示**
- 各行 末尾に「エクスポート」アイコンボタン
- フィルタ (優先度 / カテゴリ / ステータス) は **使用可** (read 権限内)
- 列「assignee」「dueDate」は表示 (read のみ)

### 3.5 S4 項目詳細 (Viewer)

- すべての input/textarea を `disabled`
- 「保存」「ステータス変更」ボタン非表示
- 「証跡URL」はクリックで新タブ表示可 (target="_blank" rel="noopener noreferrer")
- AI チャット欄は **完全非表示** (Reviewer 以上)

---

## 4. CTA 配置・優先度

### 4.1 グローバル CTA 階層 (Viewer)

| 優先度 | CTA | 配置 |
|-------|-----|------|
| 1 (主) | 「PDFエクスポート」 | Card 内 + S5 中央 |
| 2 | 「Excelエクスポート」 | Card 内 + S5 中央 |
| 3 | 「CSVエクスポート」 | S5 中央 |
| 4 (補助) | 「詳細を見る」 (S3/S4へ) | Card 右下 (text link) |

### 4.2 Anti-pattern (避けるべきもの)

| ❌ 避けるべき | 理由 |
|------------|------|
| 編集系ボタンを disabled で残す | Viewer が誤クリック → 困惑 (PAD: P-0.3) |
| 権限差を tooltip だけで説明 | 発見性が低い → 学習コスト高 |
| エクスポートボタンを下部 fold below に配置 | 主動線が見えず PV/エクスポート率低下 |
| URL 入力欄を表示しない | 「URL 入力できないこと」がわからず混乱 |

---

## 5. エクスポート モーダル仕様

```
┌────────────────────────────────────────┐
│ エクスポート: 2026Q2 医療向け初期診断    │
├────────────────────────────────────────┤
│ ◉ PDF (印刷・配布向け / 横書きA4)       │
│ ○ Excel (.xlsx / 編集可能)              │
│ ○ CSV (BI/DB取り込み向け)               │
│                                          │
│ □ ロゴ・社名を埋め込む                   │
│ □ 完了済み項目のみ含める                 │
│                                          │
│ [キャンセル]    [エクスポート開始]      │
└────────────────────────────────────────┘
```

仕様:
- shadcn/ui Modal (component-specs/modal.md 準拠)
- 開始後は **進捗モーダル** に切り替え (SSE 進捗 / 詳細は sse-feedback.md)
- 完了通知: トースト + S3 ダウンロードリンク (15分 TTL 明示)

---

## 6. アクセシビリティ要件

| 項目 | 要件 |
|------|------|
| キーボード操作 | Tab で CTA/フィルタ移動可能、Enter で実行 |
| screen reader | `aria-label="PDFエクスポート: 2026Q2 医療向け"` |
| disabled 説明 | 全 disabled に `aria-describedby` でツールチップID参照 |
| コントラスト | エクスポート CTA: White on Deep Navy `#0F2540` (14.8:1, AAA) |
| タッチ | CTA 最低 44x44px |

---

## 7. テスト観点 (Phase 5 引き継ぎ)

| 観点 | テスト種 |
|------|---------|
| Viewer ログイン → S1' ホーム表示 | E2E (5ロールマトリクス) |
| URL 入力欄 disabled + tooltip 表示 | GUI |
| エクスポート CTA → Modal → 進捗 → DL | E2E (Flow) |
| PATCH /assessment-items を呼ぶと 403 | Integration |
| 権限差バナー dismiss 後 localStorage 永続化 | E2E |

---

## 8. Phase 4 への提案 (Cycle 3.3 詳細)

| 提案 | Severity | 対応 |
|-----|---------|------|
| Viewer 専用 S1' レイアウト実装 | High | Cycle 3.3 必須 |
| 全 disabled に tooltip + aria-describedby | High | Cycle 3.2 / 3.3 |
| 権限差バナー (3回まで自動表示) | Medium | Cycle 3.3 |
| エクスポートモーダルの「自分の担当のみ」(Editor用) | Medium | Cycle 4.1 |
| Card 内エクスポート CTA 直接配置 | High | Cycle 3.3 |

<!-- END SECTION ALL -->
