# API Reference — security-checklist-tool

**Generated**: 2026-04-30 (Phase 6 / Cycle 6.1)
**OpenAPI 3.1 spec**: [openapi.json](./openapi.json) (18 paths)
**Authentication**: `sct_session` HttpOnly cookie (CC-Auth Cognito ID token)

---

## 1. 認証

すべてのエンドポイントは Cognito ID token を `sct_session` cookie で受領する。
未認証は **401 Unauthorized** (`urn:problem:sct:unauthorized`)、権限不足は **403 Forbidden** (`urn:problem:sct:forbidden`) を返す。

権限マトリクスは [spec.md §6.2](../design/spec.md#62-操作×ロール-マトリクス-ssot) を SSOT とする。
クライアント側の判定は `useRole().can(action)` (`src/lib/auth/role-context.tsx`)。

---

## 2. エラーコード (RFC 7807 Problem Details)

| HTTP | code | 用途 |
|-----:|------|------|
| 400 | `invalid_input` | zod 検証エラー |
| 401 | `unauthorized` | 未認証 |
| 403 | `forbidden` | RBAC 違反 / Viewer 編集試行 |
| 404 | `not_found` | リソース不在 / テナント越え参照 (隠蔽) |
| 409 | `conflict` | Idempotency 衝突 / 最後の owner 降格 |
| 422 | `url_blocked` | SSRF ブロック / 不正 URL |
| 429 | `rate_limited` | レート上限 (将来) |
| 502 | `upstream_error` | LLM / クローラー失敗 |
| 503 | `service_unavailable` | DB / キュー一時障害 |

レスポンス Content-Type: `application/problem+json`

---

## 3. エンドポイント一覧 (18 paths)

### 3.1 Session

| Method | Path | 認可 | 概要 |
|:------:|------|------|------|
| GET | `/api/v1/me` | 認証済 | 現在のセッション + 許可操作一覧 |
| GET | `/api/v1/me/reviewer-assignments` | 認証済 | Reviewer 確認待ち項目一覧 |

### 3.2 Companies

| Method | Path | 認可 | 概要 |
|:------:|------|------|------|
| POST | `/api/v1/companies` | `company.create` | URL → SSRF crawl → LLM 推定 → upsert |
| POST | `/api/v1/companies/stream` | `company.create` | 同上を SSE 配信 (5 ステージ) |
| GET | `/api/v1/companies/{id}` | `assessment.read` | プロフィール取得 |
| GET | `/api/v1/companies/{id}/guideline-suggestions` | `assessment.read` | baseline + industry-match + LLM rerank |

### 3.3 Assessments / Items / AI Chat

| Method | Path | 認可 | 概要 |
|:------:|------|------|------|
| POST | `/api/v1/assessments` | `assessment.create` | Idempotency-Key (24h) + snapshot + bulk-insert |
| PATCH | `/api/v1/assessment-items/{id}` | `update_note` (`update_status` for status系) | 項目更新 (reviewer は status=done のみ note) |
| POST | `/api/v1/assessment-items/{id}/ai-chat` | `ai_chat.ask` | SSE chunk → meta → done (Markdown XSS sanitize) |
| POST | `/api/v1/ai-chats/{id}/rating` | `ai_chat.rate` | Good/Bad 評価 |
| POST | `/api/v1/assessments/{id}/exports` | `export.run` | xlsx / pdf / csv 同期生成 |
| GET | `/api/v1/assessments/{id}/dashboard` | `assessment.read` | 集計 (進捗 / 期限超過 / カテゴリ別) |

### 3.4 Admin

| Method | Path | 認可 | 概要 |
|:------:|------|------|------|
| POST | `/api/v1/admin/users/invite` | `admin.invite_user` | 招待トークン発行 (24h / owner 招待は owner のみ) |
| PATCH | `/api/v1/admin/users/{id}` | `admin.invite_user` | ロール変更 (3 重安全装置) |
| POST | `/api/v1/admin/guidelines/import` | `master.update` | CSV / JSON 一括 (≤500 records, ≤2MB) |
| GET | `/api/v1/admin/audit-logs` | `audit_log.read` | フィルタ + ページネーション |
| GET | `/api/v1/admin/audit-logs/export` | `audit_log.read` | CSV (max 50k 行 / UTF-8 BOM) |

### 3.5 Master

| Method | Path | 認可 | 概要 |
|:------:|------|------|------|
| GET | `/api/v1/master/latest-version` | 認証済 | 最新の有効ガイドライン版 (MasterUpdateBanner 用) |

---

## 4. SSE エンドポイント仕様

### 4.1 POST `/api/v1/companies/stream`

```
Response: text/event-stream

event: validating
id: validating
data: {"url": "https://example.jp"}

event: crawling
id: crawling
data: {"finalUrl": "...", "hops": 0, "title": "Example"}

event: estimating
id: estimating
data: {"industry": "medical-saas", "confidence": 80, "degraded": false, "needsManualReview": false, "provider": "openai"}

event: persisting
id: persisting
data: {"companyId": "42"}

event: done
id: done
data: {"id": "42", "domain": "example.jp", "status": "completed", "degraded": false, "needsManualReview": false}
```

`Last-Event-Id` ヘッダで再開可能。

### 4.2 POST `/api/v1/assessment-items/{id}/ai-chat`

```
Response: text/event-stream

event: chunk
data: {"delta": "AWS では IAM ポリシー..."}

event: chunk
data: {"delta": "を使うことで..."}

...

event: meta
data: {"aiChatId": "123", "promptVersion": "ai-chat/v1.0.0", "degraded": false, "sanitizationNotes": []}

event: done
data: {}
```

完了時に `ai_chats` テーブルに sanitized 回答を永続化。

---

## 5. Idempotency-Key (POST `/api/v1/assessments` のみ)

- ヘッダ: `Idempotency-Key: <key>` (1..256 字 / `[A-Za-z0-9_\-:.]+` のみ)
- TTL: 24h (in-memory)
- 同一キー再投入時は前回レスポンスを 200 で返却 (新規作成しない)

---

## 6. SSRF 対策 (POST `/api/v1/companies` / stream)

- protocol allowlist: `http:` / `https:` のみ (port 80/443)
- DNS resolve → 全 IP を private/reserved 検証 → fail なら `422 url_blocked`
- redirect 最大 3 hop / 各 hop で再検証 (DNS rebinding 対策)
- timeout 10s / 5MB cap / Content-Type allowlist

詳細: [spec.md §7](../design/spec.md#7-ssrf対策仕様)

---

## 7. データオプトアウト (LLM)

OpenAI 呼び出し時に `OpenAI-Beta: log-retention=0` ヘッダ + `temperature: 0` を設定。
失敗時はルールベース fallback (`degraded: true`) を返す。

詳細: [spec.md §8.4](../design/spec.md#84-データオプトアウト契約)

---

## 8. PII / Secret マスキング (LLM 送信前)

| 種別 | パターン | 置換 |
|------|---------|------|
| email | `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}` | `<email>` |
| 電話番号 (JP) | `0\d{1,4}[- ]?\d{1,4}[- ]?\d{4}` | `<phone>` |
| クレカ | 13-19 桁数値 | `<cc>` |
| API key | `(api[-_]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}` | `<secret>` |
| AWS access key | `AKIA[0-9A-Z]{16}` | `<aws-key>` |
| ユーザー note / evidenceUrl | フィールドごと除外 | LLM コンテキストへ送信しない |

詳細: [spec.md §8.5](../design/spec.md#85-pii--secret-マスキング-送信前)

---

## 9. OpenAPI JSON

機械可読版は [openapi.json](./openapi.json) を参照。再生成:

```bash
npx tsx scripts/generate-openapi.ts
```

---
*Phase 6 / Cycle 6.1 — API Reference (security-checklist-tool)*
