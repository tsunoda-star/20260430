# Admin マニュアル

**Role**: `admin` (システム管理者)
**主な責務**: ユーザー招待・ロール変更 / プロフィール編集 / 全 Assessment 管理 / 監査ログ確認 / マスタ更新

---

## 1. できないこと

| 操作 | 不可 / 制約 |
|------|------------|
| Owner ロールへの招待・昇格 | × (Owner のみ) |
| 最後の Owner を降格 | × (409 Conflict) |
| 課金管理 (Phase 8) | × (Owner) |

---

## 2. 主要フロー

### 2.1 ユーザー招待

Owner マニュアル §2.1 と同じ。Owner ロールへの招待のみ不可。

### 2.2 ロール変更

```
PATCH /api/v1/admin/users/{id}
{ "role": "editor" }
```

### 2.3 ガイドラインマスタの一括 import (S8)

CSV / JSON で 1〜500 件を一括投入できます。

#### CSV 形式
```csv
code,name,issuer,category,domainTags,isBaseline,sourceUrl
IPA-SME,IPA Guideline,IPA,cross,sme|baseline,true,
PCI-DSS-4,PCI DSS v4.0,PCI SSC,finance,payment|finance,false,https://...
```

`domainTags` は `|` または `;` `,` で区切り。

#### JSON 形式
```json
[
  {
    "code": "IPA-SME",
    "name": "中小企業の情報セキュリティ対策ガイドライン",
    "issuer": "IPA",
    "category": "cross",
    "domainTags": ["sme", "baseline"],
    "isBaseline": true
  }
]
```

#### API
```
POST /api/v1/admin/guidelines/import
Content-Type: application/json (or text/csv)
→ 200 { format, total, created, updated }
```

#### サイズ制限
- payload ≤ 2 MB
- レコード数 ≤ 500
- 1 レコードあたり code/name/issuer/category 必須

### 2.4 監査ログの参照

```
GET /api/v1/admin/audit-logs?action=&resourceType=&userId=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&pageSize=50
```

UI 上ではフィルタを組み合わせて検索 → CSV ダウンロードが可能 (Phase 7 で UI 実装予定)。

### 2.5 ダッシュボード閲覧

特定 Assessment の進捗ドーナツ + カテゴリヒートマップ:
```
GET /api/v1/assessments/{id}/dashboard
```

---

## 3. 画面遷移 (Admin)

```
S0 ログイン
  ↓
S1 トップ ──────► S2 分析結果 ─► S3 一覧 ─► S4 項目詳細
  │                                          │
  └─► S7 ユーザー管理                          └─► S5 出力
  └─► S8 マスタ管理 (read 可)
  └─► S6 ダッシュボード
```

---

## 4. トラブルシューティング

| 症状 | 対処 |
|------|------|
| 招待で `403 forbidden` | role=owner で招待しようとした。Owner に依頼 |
| `master.update` で `403` | Admin 権限がないか、別テナントの Admin |
| マスタ import で `400 invalid_input` | フォーマット違反。CSV header / JSON schema を確認 |

---
*Phase 6 / Cycle 6.3 — Admin Manual (security-checklist-tool)*
