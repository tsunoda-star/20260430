# Flow Tests (Phase 5 / Cycle 5.4)

業務シナリオ単位の end-to-end フローを実 DB 経由で通すスイート。
spec.md / docs/test-design/flow-test-design.md の F-01〜F-06 に対応。

## Cycle 5.2 (integration) との違い

| 項目 | integration | flow |
|------|-------------|------|
| 範囲 | 単一 API / loader / exporter | tenant + user + company + assessment + items + export を一気通貫 |
| 実 LLM | 不要 (mock) | 任意 (degraded fallback も検証) |
| 実 PDF/XLSX 生成 | 単発 | シナリオ内で 3 format 連続生成 |
| 実行時間 | 数秒 | 30s〜1min/シナリオ |

## 実行手順

```bash
docker compose up -d postgres
DATABASE_URL="postgresql://sct:sct_pw@localhost:5432/security_checklist_tool?schema=public" \
  npx prisma migrate deploy
DATABASE_URL="..." npm run prisma:seed
npm run test:flow
```

## シナリオ一覧

| File | 対応 | 状態 |
|------|------|------|
| `scenarios/scenario-1-onboarding.test.ts` | F-01 medical SaaS Onboarding | ✅ 実装済 |
| `scenarios/scenario-2-collaboration.test.ts` | F-02 製造業 OT/IT 協働 | 🟡 todo |
| `scenarios/scenario-3-tenant-isolation.test.ts` | F-04 テナント分離 | 🟡 todo |
| `scenarios/scenario-4-master-update.test.ts` | F-05 マスタ更新 | 🟡 todo |
| `scenarios/scenario-5-llm-degraded.test.ts` | F-06 LLM 障害復旧 | 🟡 todo |

`it.todo()` を `it()` に置き換えると本実装に切り替わる. 雛形なので Cycle 5.4 完了
時には全シナリオが `it()` で書き直される予定。

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `DATABASE_URL is not set` | `docker compose up -d postgres` 後に環境変数を設定 |
| `Failed to load ControlItem` | `prisma:seed` 実行で 27 ガイドライン投入 |
| PDF サイズ < 500 bytes | pdfkit コンテンツ挿入が失敗。`buildPdf` の text 呼び出しを検証 |

---
Phase 5 / Cycle 5.4 — Flow Test Suite (security-checklist-tool)
