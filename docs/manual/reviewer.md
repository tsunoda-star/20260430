# Reviewer マニュアル

**Role**: `reviewer` (確認者 / 社内監査 / コンプライアンス)
**主な責務**: status=done の項目に note を追記して **確認** + AI 質問 + Good/Bad

---

## 1. できないこと

Editor 以下の編集権限はすべて持ちません。

| 操作 | 不可 |
|------|:---:|
| URL 入力 / Assessment 作成 | × |
| 企業プロフィール編集 | × |
| ステータス変更 | × |
| 担当・期限割当 | × |
| `status != done` の項目への note 追記 | × (403 forbidden) |
| ユーザー招待 / マスタ更新 / 監査ログ | × |

---

## 2. できること

| 操作 | 備考 |
|------|------|
| 全 Assessment の閲覧 | tenant 内で read 全許可 |
| **status=done 項目への note 追記** | reviewer 専用。spec.md §6.2 の「note追記のみ」 |
| AI チャット (read-only Q) | 1000 字まで質問可 |
| AI 回答に Good / Bad 評価 | `prompt_version` と一緒に永続化 |
| エクスポート (Excel/PDF/CSV) | `export.run` 権限 |

---

## 3. 主要フロー

### 3.1 確認待ち項目の取得

S1 トップ または ヘッダー右上の通知バナー (`ReviewerAssignmentsCard`) から、
自分が `assignee` で `status=done` の項目一覧を確認できます。

```
GET /api/v1/me/reviewer-assignments
→ { items: [...] (max 50, sort updatedAt desc) }
```

### 3.2 done 項目の確認 → note 追記

1. 通知から項目をクリックして S4 項目詳細を開く
2. note 欄に確認内容 (社内監査コメント等) を追記
3. 保存

#### API
```
PATCH /api/v1/assessment-items/{id}
{ "note": "監査コメント: ... (2026-04-30)" }
```

> **注意**: `status` / `assigneeId` / `dueDate` / `evidenceUrl` を含めると **403 forbidden**。`status != done` の項目への PATCH も同様に拒否されます。

### 3.3 AI チャット で確認補助

```
POST /api/v1/assessment-items/{id}/ai-chat
{ "question": "この対策はどの程度の規模で必要ですか？" }
```

回答後に Good / Bad で評価:
```
POST /api/v1/ai-chats/{aiChatId}/rating
{ "rating": "good" }
```

### 3.4 エクスポート

Editor と同じ。

---

## 4. 画面遷移 (Reviewer)

```
S0 ログイン
  ↓
S1 (URL入力欄は disabled / 通知 ReviewerAssignmentsCard 表示)
  ├─► S3 (read-only 一覧 / status=done 行の note 追記可)
  │     └─► S4 (read-only 詳細 + AIチャット + Good/Bad)
  └─► S5 出力 (エクスポート)
```

---

## 5. トラブルシューティング

| 症状 | 対処 |
|------|------|
| `status=done` 以外の項目で 403 | 仕様。Editor に依頼して done に進めてもらう |
| status / assigneeId 等を送って 403 | reviewer は note のみ送信可能。リクエスト body から除外 |
| AI チャットで 403 | viewer ロールで実行している可能性。ロールを確認 |

---
*Phase 6 / Cycle 6.3 — Reviewer Manual (security-checklist-tool)*
