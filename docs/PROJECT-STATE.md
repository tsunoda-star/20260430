# PROJECT STATE — security-checklist-tool

**Last Updated**: 2026-04-30
**Current Phase**: Phase 6 (ドキュメント) 完了 → Phase 7 (デプロイ) 着手準備
**Repository**: [tsunoda-star/20260430](https://github.com/tsunoda-star/20260430)

---

## 1. プロジェクト概要

**ビジョン**: URL 一つで、その企業に必要なセキュリティ対策の地図 (チェックシート) が手に入る。

**機能の柱**:
1. URL 投入 → SSRF safe crawl → LLM による業界・規模・PII/payment 推定
2. 推定結果に基づいて 27 ガイドライン横断のチェックシート自動生成 (LLM rerank)
3. 5 ロール (Owner/Admin/Editor/Reviewer/Viewer) によるコラボレーション + AI チャット (SSE)
4. Excel/PDF/CSV エクスポート + 監査ログ + ダッシュボード
5. WCAG AA + レスポンシブ (table → card)

---

## 2. Phase 進捗一覧

| Phase | 内容 | Issue | 状態 |
|------:|------|-------|:---:|
| 1 | 要件定義 | (docs完備) | ✅ Done |
| 2 | 設計 | #3 | ✅ Done |
| 3 | 計画 + UXレビュー | #4 | ✅ Done |
| **4** | **実装 (Wave 1-4)** | #5,#6,#7,#8,#9 | ✅ **Done** |
| **5** | **テスト** | #10 | ✅ **Done** (雛形) |
| **5.5** | **品質ゲート** | #11 | ✅ **PASS** |
| **6** | **ドキュメント** | #12 | ✅ **Done** (本コミット) |
| 7 | デプロイ | (未起票) | ⏸ |
| 8 | Platform 連携 | (未起票) | ⏸ Optional (課金 / CC-Auth 拡張) |

---

## 3. 主要成果物 (cumulative)

### 3.1 コード

| 項目 | 数 |
|------|---:|
| API ルート | **21 本** |
| client / server lib モジュール | **40+** |
| UI コンポーネント (`src/components/`) | **16** |
| Prisma model | 10 |
| 27 ガイドライン マスタ | 27 (seed) |

#### API カテゴリ別

| Category | 数 | 主要パス |
|---------|---:|---------|
| session | 2 | GET /me, /me/reviewer-assignments |
| companies | 4 | POST, POST stream (SSE), GET, GET suggestions |
| assessments / items / chat | 6 | POST assessment, PATCH item, POST ai-chat (SSE), POST rating, POST exports, GET dashboard |
| admin | 5 | invite / users[id] / guidelines/import / audit-logs / audit-logs/export |
| master | 1 | GET latest-version |
| **合計 (REST + SSE)** | **18** | (auth/login + auth/callback ページを含めて 21) |

### 3.2 テスト

| 種別 | 数 | 状態 |
|------|---:|:---:|
| ユニットテスト | **215 / 215 PASS** | ✅ |
| coverage (lines) | **91.31%** | ✅ ≥ 80% |
| coverage (branches) | 84.95% | ✅ ≥ 70% |
| 結合テスト雛形 | 6 tests / 2 files | 🟡 user 環境で実行 |
| E2E Playwright 雛形 | 39 tests / 5 specs | 🟡 user 環境で実行 |
| フローテスト雛形 | 5 シナリオ (1 実装 / 4 todo) | 🟡 user 環境で実行 |

### 3.3 ドキュメント

```
docs/
├── PROJECT-STATE.md (本ファイル)
├── api/
│   ├── api-reference.md       (Cycle 6.1)
│   └── openapi.json           (18 paths, OpenAPI 3.1)
├── architecture/
│   ├── system.md              (Cycle 6.2)
│   └── sequences.md           (5 mermaid sequences)
├── design/
│   ├── spec.md                (Phase 2)
│   ├── design-system.yml
│   ├── ui-guidelines.md
│   ├── component-library.md
│   ├── responsive-guidelines.md
│   └── component-specs/
├── manual/
│   ├── index.md               (Cycle 6.3)
│   ├── owner.md / admin.md / editor.md / reviewer.md / viewer.md
├── quality/
│   ├── mock-detection.md      (Cycle 5.5.1, PASS)
│   ├── ui-review.md           (Cycle 5.5.2, PASS)
│   └── gate-verdict.md        (Cycle 5.5.3, PASS)
├── requirements/
│   ├── requirements.md
│   ├── non-functional.md
│   └── design-requirements.md
├── runbook/
│   ├── index.md               (Cycle 6.4)
│   ├── deploy.md
│   ├── troubleshooting.md
│   └── monitoring.md
├── test-design/
│   ├── unit-test-design.md / integration / gui / e2e / flow
└── UX-REVIEW/
    ├── journey-map.md / accessibility-audit.md / confidence-ux.md /
    └── sse-feedback.md / viewer-export-flow.md / summary.md
```

---

## 4. Commit 履歴サマリ (24 commits / main)

| Phase | Cycle | Commit | 内容 |
|------:|:------|:-------|------|
| 1-3 | scaffold | 029a946 | initial scaffold (Phase 1-3 deliverables) |
| 4/W1 | foundation | 435d634 | Next.js + Tailwind + CC-Auth + Prisma |
| 4/W2 | 2.1 | ab88f01 | URL 投入 UI + zod validation |
| 4/W2 | 2.2 | 5856cc2 | SSRF-safe crawler + 37 tests |
| 4/W2 | 2.3 | b05be8a | LLM estimation pipeline + 29 tests |
| 4/W2 | 2.4 | aa1539c | checksheet generation API + 17 tests |
| 4/W2 | 2.5 | 04a4d04 | 27-guideline mapping + LLM rerank |
| 4/W3 | 3.2 | 6d58639 | 5-role permission framework + tenant guard |
| 4/W3 | 3.1 | c6c1c3f | AI chat SSE + item update + 18 tests |
| 4/W3 | 3.3 | 6111da3 | Viewer export-only flow + 9 tests |
| 4/W3 | 3.4 | 6ca6edb | SSE progress stream + cancel/retry + 10 tests |
| 4/W3 | 3.5 | 0fbdb36 | Reviewer flow + assignments + 4 tests |
| 4/W4 | 4.1 | 1f1281f | export endpoint xlsx/pdf/csv + 10 tests |
| 4/W4 | 4.2 | 1e059b8 | audit log API + CSV + 11 tests |
| 4/W4 | 4.3 | 4edfa52 | dashboard aggregate + donut/heatmap + 6 tests |
| 4/W4 | 4.4 | f4149d8 | admin user/master endpoints + 11 tests |
| 4/W4 | 4.5 | fedc70e | a11y + responsive primitives + 12 tests |
| 5 | 5.1 | c66e96a | unit coverage 91% (≥80%) + 16 tests |
| 5 | 5.2 | 9a9d475 | docker-compose + integration scaffolding |
| 5 | 5.3 | 8bc9240 | Playwright E2E scaffolding (5-role) |
| 5 | 5.4 | e7b4833 | flow test scaffolding (5 scenarios) |
| 5.5 | 5.5.1 | c41c401 | mock-detection report (PASS) |
| 5.5 | 5.5.2 | d337144 | UI quality review (PASS) |
| 5.5 | 5.5.3 | bb13a92 | quality gate final verdict (PASS) |
| 6 | 6.1 | 3e9bc0e | OpenAPI 3.1 + API reference |
| 6 | 6.2 | 1fc7c8d | system architecture + 5 sequence diagrams |
| 6 | 6.3 | 473c93f | user manuals for 5 roles |
| 6 | 6.4 | 9c8baba | operational runbook |

---

## 5. 採用された防御層 / 設計判断

| 層 | 場所 | 概要 |
|---|------|------|
| Cognito JWT verify | `src/middleware.ts` + `src/lib/auth/session.ts` | jose + remote JWKS / iss + aud / role 不明 → viewer fallback |
| RBAC SSOT | `src/lib/server/permissions.ts` | 14 actions × 5 roles マトリクス |
| zod validation | 全 API route handler | 失敗は RFC 7807 problem+json |
| Prisma `$extends` tenant-guard | `src/lib/server/db.ts` | findFirst/Many/count/Unique で tenantId 強制 |
| SSRF safe-fetch | `src/lib/crawler/safe-fetch.ts` | RFC1918/loopback/link-local/metadata IPv4/v6 deny + DNS pinning + redirect ≤3 hop 再検証 |
| LLM PII masking | `src/lib/llm/masking.ts` | email / phone / cc / api-key / AWS key |
| LLM degraded fallback | `src/lib/llm/{estimate,ai-chat}.ts` | rule-based estimator + 固定メッセージ |
| Markdown XSS sanitize | `src/lib/llm/markdown-sanitize.ts` | HTML escape + js:/data: → "#" |
| Idempotency | `src/lib/server/idempotency.ts` | in-memory 24h TTL + 形式検証 |
| WCAG コントラスト | `src/lib/a11y/contrast.ts` | Deep Navy on Off-White ≥ 4.5 (assertion) |
| Viewer 専用フロー | `WhyDisabledBanner` + `ExportCta` + `ViewerRouteGate` + `DisabledActionButton` | UX-VEF 設計 |

---

## 6. 残作業 (Outstanding)

### 6.1 Phase 7 / 8 で対応

| ID | 内容 | 担当 Phase |
|---|------|-----------|
| O-1 | url-input-form を POST /api/v1/companies/stream に配線 (現状 toast のみ) | Phase 7 (UI polish) |
| O-2 | history-empty-state.tsx を GET /api/v1/companies?recent に接続 | Phase 7 |
| O-3 | PDF 日本語フォント埋め込み (現状 Helvetica fallback) | Phase 7 |
| O-4 | `GET /api/v1/health` ALB 用ヘルスチェック実装 | Phase 7 |
| O-5 | Lighthouse 実機計測 (Performance ≥ 90 / a11y = 100) | Phase 7 デプロイ後 |
| O-6 | 結合テスト (cycle 5.2) 8 ファイル拡充 | Phase 7 (CI 構築時) |
| O-7 | E2E Playwright 5 ロール 認証通し実行 | Phase 7 (CI) |
| O-8 | フローテスト 4 シナリオ (F-02/F-04/F-05/F-06) 実装 | Phase 7 |
| O-9 | LLM サーキットブレーカー (`opossum`) | Phase 7 |
| O-10 | Idempotency-Key の Redis / DB 永続化 (multi-instance 対応) | Phase 7 |
| O-11 | 課金 (Stripe + CC-Auth) 統合 | Phase 8 |
| O-12 | レート制限 (Token Bucket) | Phase 8 |
| O-13 | エクスポート worker 化 (SQS + ECS task + S3) | Phase 8 |
| O-14 | release-notes 自動生成 | Phase 7 / 8 |

### 6.2 Phase 5.5 で許容された Medium / Low

すでに [docs/quality/mock-detection.md](./quality/mock-detection.md) §6 / [ui-review.md](./quality/ui-review.md) §3 に記載済。
strict policy で prod 反映前に解消推奨。

---

## 7. 主要環境変数

`.env.local` (`.env.example` をコピー):

| 変数 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL (local: docker-compose / prod: RDS via SSM) |
| `COGNITO_USER_POOL_ID` | CC-Auth User Pool |
| `COGNITO_CLIENT_ID` | CC-Auth App Client |
| `COGNITO_REGION` | ap-northeast-1 |
| `NEXT_PUBLIC_CC_AUTH_REDIRECT_URI` | http://localhost:3000/auth/callback (local) |
| `OPENAI_API_KEY` | OpenAI Enterprise (data opt-out) |
| `LLM_PRIMARY_PROVIDER` | openai / fallback |
| `OPENAI_MODEL` | 既定 `gpt-4o-mini` |
| `SESSION_COOKIE_NAME` | 既定 `sct_session` |

---

## 8. 開発コマンド

```bash
# 起動
npm run dev                      # http://localhost:3000

# 検証
npm test                         # ユニット (vitest) 215 tests
npm run test:coverage            # coverage (≥80% threshold)
npm run test:integration         # 結合テスト (要 Docker / DATABASE_URL)
npm run test:flow                # フローテスト
npx playwright test              # E2E (要 Cognito + browser)

npm run typecheck                # tsc --noEmit
npm run lint                     # next lint
npm run build                    # next build

# Prisma
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate           # = migrate dev
npm run prisma:seed              # 27 ガイドライン

# OpenAPI 再生成
npx tsx scripts/generate-openapi.ts
```

---

## 9. 関連リンク

- API リファレンス: [`docs/api/api-reference.md`](./api/api-reference.md)
- システム構成: [`docs/architecture/system.md`](./architecture/system.md)
- 5 ロール マニュアル: [`docs/manual/index.md`](./manual/index.md)
- Runbook: [`docs/runbook/index.md`](./runbook/index.md)
- 品質ゲート: [`docs/quality/gate-verdict.md`](./quality/gate-verdict.md)
- 設計仕様: [`docs/design/spec.md`](./design/spec.md)

---
*Phase 6 / Cycle 6.5 — Project State Snapshot (security-checklist-tool)*
