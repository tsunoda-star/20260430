# Integration Tests (Phase 5 / Cycle 5.2)

ローカル PostgreSQL 上で実 DB 経由の API / loader / exporter 結合を検証するスイート.

## 前提

- Docker Desktop が起動していること
- `.env.local` の `DATABASE_URL` が `postgresql://sct:sct_pw@localhost:5432/security_checklist_tool?schema=public`

## 実行手順

```bash
# 1. PostgreSQL 起動
docker compose up -d postgres

# 2. スキーマ適用 (初回のみ; 既存環境では `migrate dev` 推奨)
DATABASE_URL="postgresql://sct:sct_pw@localhost:5432/security_checklist_tool?schema=public" \
  npx prisma migrate deploy

# 3. 27 ガイドラインマスタ seed
DATABASE_URL="postgresql://sct:sct_pw@localhost:5432/security_checklist_tool?schema=public" \
  npm run prisma:seed

# 4. 結合テスト実行
npm run test:integration

# 5. クリーンアップ (任意)
docker compose down
```

## 構成

```
tests/integration/
├── README.md           ← 本ファイル
├── setup.ts            ← Prisma 接続 / tenant tear-down ヘルパー
└── api/
    ├── health.test.ts          ← DB connectivity + seed 保持確認
    └── exporter-flow.test.ts   ← Assessment 作成 → loader → exporter 結合
```

## Cycle 5.2 完了に向けた追加対象 (TODO)

本フォルダの雛形は最小スイート (3 + 3 = 6 tests). Cycle 5.2 完了時には以下を網羅予定:

- `api/companies.test.ts` — POST /api/v1/companies (URL → crawl → estimate → upsert)
- `api/assessments.test.ts` — POST /api/v1/assessments (Idempotency-Key + bulk-insert)
- `api/assessment-items.test.ts` — PATCH (reviewer 制約 / role guard)
- `api/ai-chat.test.ts` — POST SSE chunk 受信 + ai_chats persist
- `api/admin-audit-logs.test.ts` — フィルタ + ページネーション + CSV
- `api/admin-users.test.ts` — invite / role 変更 / 最後の owner 降格 conflict
- `api/admin-guidelines-import.test.ts` — JSON / CSV インポート
- `api/dashboard.test.ts` — 集計値検証

## トラブルシューティング

| エラー | 原因と対処 |
|--------|----------|
| `DATABASE_URL is not set` | env を export して再実行、または `.env.local` を読む shell プロファイルを使用 |
| `P1001 Can't reach database` | `docker compose up -d postgres` が完了しているか確認 (`docker compose ps`) |
| `P3018 / P3009 migration failed` | DB をクリーンアップ: `docker compose down -v` → 起動し直し |
| `relation does not exist` | `prisma migrate deploy` を未実行. 手順 2 を実施 |
