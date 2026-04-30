# Viewer マニュアル

**Role**: `viewer` (取引先審査担当 / 経営層 / 監査法人 / 外部コンサル)
**主な責務**: 既存チェックシートの **閲覧** と **エクスポート (Excel/PDF/CSV)** のみ

---

## 1. できること / できないこと

| 操作 | 可否 |
|------|:---:|
| 全 Assessment の閲覧 (read all) | ✓ |
| エクスポート (Excel / PDF / CSV) | ✓ |
| URL 入力・分析開始 | × |
| Assessment 作成 / 削除 / 編集 | × |
| ステータス変更 / メモ・証跡登録 | × |
| AI チャット | × |
| ユーザー管理 / マスタ更新 / 監査ログ | × |

---

## 2. 専用フロー (UX-VEF-20260430)

Viewer はログイン後、専用の **エクスポート最優先動線** に誘導されます。

```
S0 ログイン
  ↓
S1 トップ (URL入力欄は ExportCta に置換)
  │  「閲覧者 (Viewer) はエクスポート機能のみご利用いただけます」表示
  ↓
S3 read-only 一覧 (フィルタ可 / 行クリック → S4 はブロック)
  ↓
S5 設定・出力 (Export ボタンが最も目立つ位置)
  ↓
Excel / PDF / CSV ダウンロード
```

---

## 3. 主要フロー

### 3.1 ログイン直後

ログイン直後、画面上部に通知バナー (`WhyDisabledBanner`) が表示されます:

> **あなたは Viewer です — 閲覧とエクスポートが可能です** [エクスポート画面へ]

このバナーは初回 + 2回までは自動表示、それ以降は dismiss 後に再表示されません (localStorage 記憶)。

### 3.2 エクスポート (主要動線)

1. トップ画面の「エクスポート画面を開く」ボタンをクリック
2. 過去 Assessment 一覧から対象を選択
3. format (xlsx / pdf / csv) を選択
4. ダウンロード

#### API
```
POST /api/v1/assessments/{id}/exports
{ "format": "xlsx" }
→ binary (Content-Disposition: attachment; filename="...")
```

### 3.3 read-only 閲覧 (二次動線)

S3 一覧で行をクリックすると S4 詳細を **read-only** で開けます (Phase 7 で UI 実装)。
編集系のボタンは disabled で、tooltip に「Viewer 権限では編集できません」と表示されます。

---

## 4. 制約 (隠蔽 / 遮断)

### 4.1 アクセス遮断 (ViewerRouteGate)

Viewer が以下の URL に直接アクセスすると、自動的に `/app/viewer` (Viewer ホーム) にリダイレクトされます:

| 遮断対象 | 理由 |
|---------|------|
| `/app/companies/*` | 編集系 (S2) |
| `/app/items/edit/*` | 項目編集 (S4 編集) |
| `/app/admin/users` | ユーザー管理 (S7) |
| `/app/admin/master` | マスタ管理 (S8) |

### 4.2 サーバー側 403 forbidden

UI 上は disabled / 非表示でも、API を直接叩くと **403 Forbidden** で拒否されます (信頼境界)。

```
POST /api/v1/companies → 403 forbidden
POST /api/v1/assessments → 403 forbidden
PATCH /api/v1/assessment-items/{id} → 403 forbidden
POST /api/v1/assessment-items/{id}/ai-chat → 403 forbidden
```

GET 系 + Export のみ 200 OK で応答します。

---

## 5. トラブルシューティング

| 症状 | 対処 |
|------|------|
| 編集ボタンが押せない | 仕様。Viewer は閲覧+エクスポートのみ可能。担当者に編集を依頼 |
| 編集画面に直接アクセスして自動リダイレクト | 仕様。`/app/viewer` から再度動線をたどってください |
| バナーが消えて再表示されない | dismiss 上限超過。localStorage の `sct.viewerBanner.dismissCount` を削除すれば再表示 |
| エクスポートが 403 | 別テナントの Assessment にアクセスしている可能性。組織を確認 |

---
*Phase 6 / Cycle 6.3 — Viewer Manual (security-checklist-tool)*
