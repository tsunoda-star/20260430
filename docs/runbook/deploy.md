# Deployment Runbook

**Phase 6 / Cycle 6.4** — Phase 7 (デプロイ) 着手時の参照ドキュメント。
本書は **手順書** であり、コマンド実体は Phase 7 の `aws-fast-deploy` スキル等で生成される。

---

## 1. 環境一覧

| 環境 | URL | DB | Cognito | LLM |
|------|-----|----|---------|-----|
| **local** | http://localhost:3000 | docker compose postgres | env で fallback | env (OPENAI_API_KEY) |
| **dev** | https://security-checklist-tool-dev.aidreams-factory.com | RDS PostgreSQL (Multi-AZ optional) | CC-Auth dev pool | OpenAI dev (rate cap) |
| **prod** | https://security-checklist-tool.aidreams-factory.com | RDS Multi-AZ | CC-Auth prod pool | OpenAI prod (Enterprise) |

---

## 2. ローカル起動

```bash
# 1. 環境変数
cp .env.example .env.local
# DATABASE_URL / COGNITO_* / OPENAI_API_KEY を埋める

# 2. DB
docker compose up -d postgres
DATABASE_URL="postgresql://sct:sct_pw@localhost:5432/security_checklist_tool?schema=public" \
  npx prisma migrate dev
DATABASE_URL="..." npm run prisma:seed

# 3. dev サーバ
npm run dev          # http://localhost:3000
```

---

## 3. dev / prod デプロイ (Phase 7 想定)

### 3.1 前提

- `.ccagi.yml` の `dev_subdomain` / `prod_subdomain` が設定済み
- AWS アカウントへの OIDC GitHub 認証が確立 (Phase 7 で `/aws-fast-deploy --setup-oidc`)
- SSM Parameter Store に Cognito IDs / OPENAI_API_KEY を投入済み
  - `/security-checklist-tool/dev/cognito/user_pool_id`
  - `/security-checklist-tool/dev/cognito/client_id`
  - `/security-checklist-tool/dev/cognito/region`
  - `/security-checklist-tool/dev/openai/api_key` (Secrets Manager 推奨)

### 3.2 手順 (CCAGI Phase 7)

```bash
# dev 環境
ccagi-sdk init                         # 初回のみ
/setup-infrastructure --env dev        # ECR/ECS/ALB/CloudFront 等
/setup-pipeline --env dev              # CodePipeline (GitHub OIDC)
/deploy-dev                            # main ブランチを dev に反映

# prod 環境 (承認付き)
/deploy-prod
```

### 3.3 主要 AWS リソース構成 (Phase 7 標準)

| カテゴリ | リソース |
|---------|---------|
| Edge | CloudFront + Route53 |
| Compute | ECS Fargate (Next.js / 1〜2 task) |
| LB | ALB (HTTPS) |
| DB | RDS PostgreSQL 15 Multi-AZ + Backup 30d |
| Storage | S3 SSE-KMS (将来 export 出力用) |
| Secrets | SSM Parameter Store / Secrets Manager |
| 監視 | CloudWatch Logs / Metrics + Sentry |

### 3.4 Pre-deploy 検証

```bash
ccagi-sdk doctor                       # ヘルスチェック
/run-predeploy-verification            # 包括的な事前検証
```

---

## 4. ロールバック

| 状況 | 手順 |
|------|------|
| ECS タスク異常 | CodePipeline 前回成功リビジョンで `/deploy-rollback --env <env>` |
| DB マイグレーション失敗 | `prisma migrate resolve --rolled-back <name>` で戻し、コードも前バージョンに戻す |
| 設定ミス (Cognito / OpenAI) | SSM 値を更新 → ECS タスク再デプロイ |

ロールバック原則:
- DB スキーマ破壊変更は **forward-only**。`add column NOT NULL` 等は段階的に (nullable add → backfill → enforce)
- アーティファクトは S3 / ECR で 30 日保持

---

## 5. リリースチェックリスト

| # | 項目 |
|---|------|
| 1 | `npm test` 全 PASS (ユニット 215+) |
| 2 | `npm run typecheck` 0 errors |
| 3 | `npm run lint` 0 errors |
| 4 | `npm run build` 成功 |
| 5 | `npm run test:integration` 成功 (CI / 実 DB) |
| 6 | `npx playwright test` 成功 (CI / 5 ロール) |
| 7 | `docs/quality/mock-detection.md` Critical=0 |
| 8 | `docs/quality/ui-review.md` PASS |
| 9 | `prisma/migrations/` 差分の peer review |
| 10 | `.ccagi.yml` の dev/prod サブドメイン更新確認 |
| 11 | AWS SSM Parameter Store 値の最新化 |
| 12 | release-notes 更新 (`docs/release-notes/<version>.md`, Phase 7 で生成) |

---
*Phase 6 / Cycle 6.4 — Deployment Runbook (security-checklist-tool)*
