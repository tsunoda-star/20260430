# Editor マニュアル

**Role**: `editor` (情報セキュリティ担当者 / 業務オペレータ)
**主な責務**: URL 投入・チェックシート生成 / 項目編集 / 担当・期限割当 / AI チャット

---

## 1. できないこと

| 操作 | 不可 |
|------|:---:|
| 企業プロフィール編集 (Company.update) | × |
| 評価シート削除 | × |
| ユーザー招待 / ロール変更 | × |
| マスタ更新 (ガイドライン import) | × |
| 監査ログ参照 | × |

これらが必要な場合は Admin / Owner に依頼してください。

---

## 2. 主要フロー

### 2.1 URL を投入してチェックシート生成

#### Step 1: トップ画面 (S1) で URL 入力
1. URL 欄に `https://your-company.example.jp` を入力
2. 「分析を開始」をクリック
3. SSE 進捗ストリーム (Cycle 3.4) で 5 ステージが進行:
   - `validating` → `crawling` → `estimating` → `persisting` → `done`
4. 完了後、推定された業界・規模が画面に表示

#### Step 2: 分析結果 (S2) で属性確認 / 修正
- 推定の `confidence < 50` の場合「自動修正推奨」バッジが表示
- 業界 / 規模 / 個人情報取扱 / 決済取扱を必要に応じて手動修正

#### Step 3: ガイドライン候補 (S2 続き) で選定
- baseline (横断必須) は自動付与
- industry-match で推定業界に該当するガイドラインを LLM rerank 済みで表示
- 不要なものを除外、または追加

#### Step 4: 評価シート作成 (S3 へ)
1. タイトル入力 (例: "2026Q2 医療向け初期診断")
2. 「シート生成」をクリック
3. 数百件の制御項目が `normalized_key` で重複排除されてリスト化

#### API 経路
```
POST /api/v1/companies (or /companies/stream)
GET  /api/v1/companies/{id}/guideline-suggestions
POST /api/v1/assessments
```

### 2.2 項目の編集 (S4)

S3 の一覧で行をクリックすると右ペインで詳細表示。

| 編集可能フィールド | 説明 |
|------------------|------|
| `status` | open / in_progress / done / not_applicable |
| `note` | 内部メモ (LLM コンテキストには送信されない) |
| `assigneeId` | 担当者 (User.id) |
| `dueDate` | 期限 (YYYY-MM-DD) |
| `evidenceUrl` | 証跡 URL |

#### API
```
PATCH /api/v1/assessment-items/{id}
{ "status": "in_progress", "note": "...", "assigneeId": "5", "dueDate": "2026-05-31" }
```

### 2.3 AI チャット (S4 右ペイン)

#### Step
1. 項目を開いた状態で「AI に質問する」入力欄に質問を入力
2. SSE で chunk が流れて回答が表示される
3. 完了したら **Good / Bad** をクリックして評価
4. 評価は `prompt_version` と一緒に保存され Phase 6 で月次評価対象

#### 制約
- 質問は 1000 文字まで
- `note` / `evidenceUrl` は AI コンテキストに送信されない (PII 除外)
- LLM 障害時は固定メッセージ + 参考リンクが返る

#### API
```
POST /api/v1/assessment-items/{id}/ai-chat
{ "question": "AWS でこのコントロールはどう実装しますか？" }
→ text/event-stream (chunk → meta → done)

POST /api/v1/ai-chats/{id}/rating
{ "rating": "good" }
```

### 2.4 エクスポート

```
POST /api/v1/assessments/{id}/exports
{ "format": "xlsx" }   // or "pdf" / "csv"
→ binary stream (Content-Disposition: attachment)
```

---

## 3. 画面遷移 (Editor)

```
S0 ログイン
  ↓
S1 URL入力 ──► S2 分析結果 ──► S3 一覧 ──► S4 項目詳細
                                  │             │
                                  └─► S5 出力 ◄─┘
```

---

## 4. トラブルシューティング

| 症状 | 対処 |
|------|------|
| URL が `422 url_blocked` | 内部 IP / metadata / localhost 等は不可。公開 URL を入力 |
| `confidence: 0` で推定不能 | extracted text が空。手動でプロフィール入力 (S2 修正) |
| AI 応答が「AI機能が一時停止中です」 | LLM 障害。手動入力で続行可能 |
| 編集の保存で 403 | reviewer / viewer ロールではないか確認 |

---
*Phase 6 / Cycle 6.3 — Editor Manual (security-checklist-tool)*
