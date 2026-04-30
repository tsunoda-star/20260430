# System Architecture — security-checklist-tool

**Generated**: 2026-04-30 (Phase 6 / Cycle 6.2)
**Source**: `docs/design/spec.md` §1-2 / Phase 4 実装

---

## 1. 全体構成

```mermaid
graph TB
  subgraph client["Client (Browser)"]
    UI[Next.js App Router pages]
    Hooks[React fixtures<br/>useRole / useEventStream]
  end

  subgraph edge["Edge / Middleware"]
    MW[middleware.ts<br/>Cognito JWT verify]
  end

  subgraph nextjs["Next.js Server (Node runtime)"]
    Routes[Route Handlers<br/>21 routes]
    Lib[src/lib/server/*<br/>permissions / db / audit /<br/>idempotency / sse / exporters]
    Crawler[src/lib/crawler<br/>SSRF safe-fetch]
    Llm[src/lib/llm<br/>estimate / rerank / ai-chat /<br/>masking / sanitize]
    A11y[src/lib/a11y<br/>WCAG contrast]
  end

  subgraph data["Data layer"]
    Postgres[(PostgreSQL 15<br/>Prisma client w/<br/>$extends tenant-guard)]
  end

  subgraph external["External services"]
    Cognito[CC-Auth Cognito<br/>OIDC PKCE]
    OpenAI[OpenAI Chat Completions<br/>log-retention=0]
    Web[(Public web<br/>via SSRF safe-fetch)]
  end

  UI -->|fetch + cookie| MW
  MW --> Routes
  Routes --> Lib
  Routes --> Crawler
  Routes --> Llm
  Lib --> Postgres
  Crawler --> Web
  Llm --> OpenAI
  MW -.JWKS verify.-> Cognito
```

---

## 2. レイヤー責務

| Layer | 主な責務 | 主要モジュール |
|-------|----------|---------------|
| **Client** | UI / motion/react / role-aware widgets | `src/components/*` (16 files) + `src/hooks/use-event-stream.ts` |
| **Middleware** | Cognito ID token JWKS 検証 / 認証必須経路の cookie ガード | `src/middleware.ts` |
| **Route Handlers** | RBAC 認可 + zod 検証 + Idempotency + SSE + AuditLog | `src/app/api/v1/**/route.ts` (21 routes) |
| **Server libs** | Prisma 拡張 / セッション / SSE / Exporters / Audit | `src/lib/server/*` |
| **Domain libs** | SSRF / LLM / Masking / Sanitize / a11y | `src/lib/{crawler,llm,a11y}` |
| **Data** | Prisma 5 + PostgreSQL 15 + tenant-guard 拡張 | `prisma/schema.prisma` (10 models) |

---

## 3. 主要セキュリティ防御層

```mermaid
graph LR
  Req[HTTP Request] --> M1[middleware<br/>JWT verify]
  M1 --> M2[requireActionFromRequest<br/>Permission Matrix §6.2]
  M2 --> M3[zod validate]
  M3 --> M4[resolveTenantContext<br/>org_id → Tenant.id]
  M4 --> M5[Prisma $extends<br/>tenant-guard]
  M5 --> Db[(DB)]

  M3 -.SSRF-.-> SF[safeFetch<br/>deny-by-default]
  M3 -.LLM-.-> LM[estimate / streamAiChat<br/>+ rule-based fallback]
  LM -.PII mask-.-> Mk[maskSensitive]
  LM -.XSS-.-> Sn[sanitizeAiChatMarkdown]
```

| 層 | 仕様 |
|---|------|
| 1. JWT 検証 | jose + remote JWKS / iss + aud 照合 / role 不明時 viewer 丸め |
| 2. RBAC | spec.md §6.2 マトリクスを SSOT 化 (14 actions × 5 roles) |
| 3. zod 検証 | 全 Request body / Query を zod schema で検証 → 400 |
| 4. tenant-guard | Prisma `$extends` で findFirst/findMany/count/findUnique に tenantId を強制 (TenantScopeViolation) |
| 5. SSRF safe-fetch | RFC1918 / loopback / link-local / metadata IPv4/IPv6 deny + DNS pinning + redirect ≤3 hop 再検証 |
| 6. LLM masking | 送信前に email / phone / cc / api-key / AWS key を `<token>` 置換 |
| 7. Markdown XSS | LLM 出力に対し HTML エスケープ + js:/data: スキーマ → "#" 置換 |
| 8. RFC 7807 | すべての非 2xx は `application/problem+json` で詳細を返却 |

---

## 4. データモデル概観 (Prisma 10 models)

```mermaid
erDiagram
  Tenant ||--o{ User : "has"
  Tenant ||--o{ Company : "owns"
  Tenant ||--o{ Assessment : "tracks"
  Tenant ||--o{ AuditLog : "logs"
  Company ||--o{ Assessment : "for"
  Assessment ||--o{ AssessmentGuideline : "applies"
  Assessment ||--o{ AssessmentItem : "contains"
  AssessmentItem ||--o{ AiChat : "discusses"
  AssessmentItem }o--|| ControlItem : "uses"
  ControlItem }o--|| GuidelineVersion : "belongs_to"
  GuidelineVersion }o--|| Guideline : "version_of"
  AssessmentGuideline }o--|| GuidelineVersion : "links"
  User ||--o{ AssessmentItem : "assignee/updater"
  User ||--o{ AiChat : "asks"
  User ||--o{ AuditLog : "actor"
```

| 区分 | Models |
|------|--------|
| **Master (tenant 越え)** | `Guideline`, `GuidelineVersion`, `ControlItem` |
| **Multi-tenant** | `Tenant`, `User`, `Company`, `Assessment`, `AssessmentGuideline`, `AssessmentItem`, `AiChat`, `AuditLog` |

詳細は [prisma/schema.prisma](../../prisma/schema.prisma).

---

## 5. ランタイム / デプロイメント想定

```mermaid
graph TB
  subgraph aws["AWS (Phase 7 想定)"]
    CF[CloudFront]
    ALB[ALB]
    ECS[ECS Fargate<br/>Next.js node:20]
    RDS[(RDS PostgreSQL<br/>Multi-AZ)]
    SQS[(SQS / Worker<br/>future export queue)]
    S3[(S3 SSE-KMS<br/>future exports)]
    SSM[SSM Parameter Store<br/>Cognito IDs]
  end

  subgraph external["External"]
    Cognito[CC-Auth Cognito]
    OpenAI[OpenAI API]
  end

  CF --> ALB --> ECS
  ECS --> RDS
  ECS -.future.-> SQS
  SQS -.future.-> S3
  ECS --> SSM
  ECS -.JWKS.-> Cognito
  ECS -.HTTPS.-> OpenAI
```

Phase 7 で `aws-fast-deploy` スキル (CloudFront + ECS + ALB + S3) でこの構成を生成する想定。

---

## 6. 関連ドキュメント

- API リファレンス: [`docs/api/api-reference.md`](../api/api-reference.md)
- OpenAPI 3.1 spec: [`docs/api/openapi.json`](../api/openapi.json)
- 設計仕様: [`docs/design/spec.md`](../design/spec.md)
- デザインシステム: [`docs/design/design-system.yml`](../design/design-system.yml)
- 品質ゲート: [`docs/quality/`](../quality/)
- シーケンス図: [`docs/architecture/sequences.md`](./sequences.md)

---
*Phase 6 / Cycle 6.2 — System Architecture (security-checklist-tool)*
