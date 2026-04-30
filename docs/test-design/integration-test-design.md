# Integration Test Design — security-checklist-tool

**Document ID**: TEST-INT-20260430
**Phase**: 2 (Design)
**Framework**: Vitest + Testcontainers (PostgreSQL) + MSW
**Scope**: API エンドポイント + DB + 外部 API mock

---

## 1. 環境

| 要素 | 構成 |
|------|------|
| DB | Testcontainers PostgreSQL 15 (each suite で fresh schema) |
| Auth | CC-Auth JWT を fixture で発行 (signing key を test secret) |
| LLM | MSW でモック (estimation/ai_chat 各 fixture) |
| Crawler | MSW で HTML 固定 + 一部はローカル HTTP server (SSRF テスト用に内部IP) |
| S3 | LocalStack (export 確認) |
| Queue | in-memory mock |

実行: `npm run test:integration` (Docker 必須)。

<!-- END SECTION 1 -->

## 2. テストスイート

### 2.1 Companies API (URL投入)

| ID | ケース | 期待 |
|----|--------|------|
| I-C-01 | POST /companies (有効URL) | 202 + crawl & inference 開始 |
| I-C-02 | POST /companies (内部IP URL) | 422 url_blocked + audit_log |
| I-C-03 | POST /companies (重複domain in tenant) | 200 既存返却 |
| I-C-04 | PATCH /companies/:id (manual override) | inferred_data + user_overrides 両保持 |
| I-C-05 | テナント越え GET → 404 | other tenant の company は不可視 |

### 2.2 Assessments API (シート生成)

| ID | ケース | 期待 |
|----|--------|------|
| I-A-01 | POST /assessments (baseline only) | IPA-SME + METI-MGMT が確実に含まれる |
| I-A-02 | POST /assessments (medical inferred) | 厚労省医療情報 が含まれる |
| I-A-03 | guideline_version_snapshot がJSON保存 | マスタ更新後も snapshot 不変 |
| I-A-04 | bulk-insert assessment_items が control_items 数と一致 | 重複排除後の数 |
| I-A-05 | Idempotency-Key 同値で 2回呼び出し | 同一 assessment 返却 |
| I-A-06 | Editor が DELETE → 403 | RBAC |

### 2.3 Assessment Items

| ID | ケース | 期待 |
|----|--------|------|
| I-I-01 | PATCH status=done | updated_by/updated_at + audit_log |
| I-I-02 | PATCH (Viewer JWT) | 403 |
| I-I-03 | PATCH (Reviewer) note追記のみ可 | status変更は 403 |
| I-I-04 | PATCH 担当assignee_id (他テナントのuser) | 422 invalid_input |

### 2.4 AI Chat (SSE)

| ID | ケース | 期待 |
|----|--------|------|
| I-AI-01 | POST /assessment-items/:id/ai-chat | SSE stream 200 + 累積chunks |
| I-AI-02 | LLM provider 5xx | サーキットブレーカー open → fallback メッセージ |
| I-AI-03 | レート制限超過 | 429 + Retry-After |
| I-AI-04 | プロンプトに note/evidence_url 不混入 | snapshot test (LLM mock の req body 検査) |
| I-AI-05 | rating POST | ai_chats.rating 更新 |

### 2.5 Export

| ID | ケース | 期待 |
|----|--------|------|
| I-E-01 | POST /assessments/:id/exports format=xlsx | 202 + queued |
| I-E-02 | Worker完了後 GET /exports/:id | 200 + S3 署名URL (15min TTL) |
| I-E-03 | Viewer ロールでも実行可 | 200 (権限OK) |
| I-E-04 | format=pdf 200項目 | 15s 以内、レイアウト崩れなし (smoke) |

### 2.6 Auth / Tenant Isolation

| ID | ケース | 期待 |
|----|--------|------|
| I-T-01 | Tenant A の JWT で Tenant B の assessment GET | 404 (not_found) |
| I-T-02 | Prisma middleware が tenantId 自動WHEREに混入 | DB クエリ snapshot で確認 |
| I-T-03 | session expired | 401 + refresh トリガー |

### 2.7 SSRF Block (E2E in DB context)

| ID | ケース | 期待 |
|----|--------|------|
| I-S-01 | POST /companies (URL→ローカルserverが 10.x にバインド) | 422 + audit_log 'ssrf.block' |
| I-S-02 | redirect chain 中の private IP | 422 |
| I-S-03 | DNS rebinding (TTL=0) | pinnedAgent で IP固定 → 検知 |

### 2.8 Audit Log

| ID | ケース | 期待 |
|----|--------|------|
| I-AU-01 | 全変更系API → audit_logs 1行作成 | tenant_id, user_id, before/after JSON |
| I-AU-02 | rollback (DB error) → audit_log 不書き込み | tx 一貫性 |

<!-- END SECTION 2 -->

## 3. データセットアップ

```typescript
// __tests__/integration/fixtures/seed.ts
seedTenants([{ id: 1, name: "Tenant A" }, { id: 2, name: "Tenant B" }]);
seedUsers([
  { tenantId:1, role:'owner' },
  { tenantId:1, role:'admin' },
  { tenantId:1, role:'editor' },
  { tenantId:1, role:'reviewer' },
  { tenantId:1, role:'viewer' },
  { tenantId:2, role:'owner' }
]);
seedGuidelines(/* 27件 from masterv1.0 */);
```

<!-- END SECTION 3 -->

## 4. 並列実行

- DB は test ごとに schema 切替 (`pg_temp` or namespaced schema)
- MSW は `setupServer` でテストごとにリセット
- 並列度 4 (Vitest `--threads`)

<!-- END SECTION 4 -->

---

*CCAGI SDK Phase 2 — Integration Test Design (TEST-INT-20260430)*
