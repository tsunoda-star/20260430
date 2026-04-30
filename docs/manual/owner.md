# Owner マニュアル

**Role**: `owner` (テナントオーナー / 課金担当)
**主な責務**: テナント全体の管理 / Owner 譲渡 / 課金 (Phase 8 連携時)

---

## 1. できること

Owner は **すべての操作** を実行できます。Admin の上位ロールとして、以下の点が異なります:

| Admin との違い | Owner のみ |
|---------------|-----------|
| ロール `owner` への招待・昇格 | ✓ |
| Owner ロール本人の自分降格 | × (locked-out 防止) |
| 最後の Owner を降格 | × (テナント乗っ取り防止) |
| 課金 (Phase 8) | ✓ |

---

## 2. 主要フロー

### 2.1 ユーザー招待 (Admin / Editor / Reviewer / Viewer / **Owner**)

1. ヘッダーから S7 ユーザー管理を開く (※ Phase 7 で実装予定)
2. 「ユーザーを招待」をクリック
3. Email + ロール (Owner / Admin / Editor / Reviewer / Viewer) を入力
4. 「招待を送信」で 24h 有効なトークンが発行される
5. 取得した招待 URL をユーザーに共有 (現状は手動共有)

#### API
```
POST /api/v1/admin/users/invite
{ "email": "newuser@example.com", "role": "editor" }
→ 201 { token, inviteUrl, expiresAt }
```

### 2.2 ロール変更

1. S7 のユーザー一覧で対象ユーザーを選択
2. ロールをドロップダウンで変更 → 保存
3. 確認: 「最後の Owner」を Owner 以外に降格しようとすると **409 Conflict** が返却される
4. 自分自身を Viewer / Reviewer に降格しようとすると **403 Forbidden** (locked-out 防止)

#### API
```
PATCH /api/v1/admin/users/{id}
{ "role": "admin" }
```

### 2.3 監査ログの参照 / CSV エクスポート

`audit_log.read` 権限。Admin と同じ操作。

```
GET /api/v1/admin/audit-logs?action=admin.user_update&from=2026-04-01
GET /api/v1/admin/audit-logs/export?action=admin.user_update
```

### 2.4 ガイドラインマスタ更新 (Admin と共有)

Admin マニュアル §3 を参照。

### 2.5 課金 (Phase 8 連携時)

CCAGI SDK Phase 8 で `/setup-platform-billing` を実行すると Stripe が組み込まれます。
2026-04 時点では未実装。

---

## 3. UI コンポーネント

| 機能 | 主要 component |
|------|---------------|
| マスタ更新通知 | `MasterUpdateBanner` (`src/components/master-update-banner.tsx`) |
| 5 ロール権限マトリクス表示 | `RoleMatrixDisplay` (`src/components/role-matrix-display.tsx`) |
| ダッシュボード | `ProgressDonut` + `CategoryHeatmap` |

---

## 4. トラブルシューティング

| 症状 | 対処 |
|------|------|
| 自分を降格しようとして 403 | 仕様。別 Owner を立ててから自分を Admin に降格してください |
| 最後の Owner を降格して 409 | 同上。Owner を 2 名にしてから操作 |
| 招待トークンが期限切れ | 24h 過ぎた場合は再発行 |

---
*Phase 6 / Cycle 6.3 — Owner Manual (security-checklist-tool)*
