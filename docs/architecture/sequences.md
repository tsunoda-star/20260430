# Sequence Diagrams — security-checklist-tool

**Generated**: 2026-04-30 (Phase 6 / Cycle 6.2)
**Source**: `docs/design/spec.md` §4 / Phase 4 実装

---

## SEQ-1: URL投入 → クロール → LLM 推定 → 保存

`POST /api/v1/companies` (同期版) のフロー。Cycle 2.4 実装。

```mermaid
sequenceDiagram
  autonumber
  participant U as User (editor+)
  participant FE as Next.js Page
  participant MW as middleware.ts
  participant RH as POST /api/v1/companies
  participant Auth as requireActionFromRequest<br/>(company.create)
  participant Crw as crawl()<br/>safe-fetch + cheerio
  participant Web as Public Web
  participant Llm as estimate()
  participant OAI as OpenAI
  participant Db as Prisma + tenant-guard
  participant Aud as writeAudit()

  U->>FE: URL form submit
  FE->>MW: POST /api/v1/companies (cookie)
  MW->>MW: verify Cognito ID token (JWKS)
  MW->>RH: forward
  RH->>Auth: requireActionFromRequest('company.create')
  Auth-->>RH: ok / 401|403

  RH->>RH: zod parse { url }
  RH->>Crw: crawl(url)

  Crw->>Crw: validateUrl: protocol/port/host
  Crw->>Crw: DNS resolve4/6
  alt blocked
    Crw-->>RH: throw UrlBlockedError(reason)
    RH->>Aud: action='ssrf.block'
    RH-->>FE: 422 url_blocked
  else allowed
    Crw->>Web: GET (redirect manual ≤3 hops, each re-validated)
    Web-->>Crw: HTML (≤5MB / Content-Type allowlist)
    Crw->>Crw: cheerio extract (title/meta/og/h1/text 4kB)
    Crw-->>RH: CrawlResult
  end

  RH->>Llm: estimate({url,title,description,publicText})
  Llm->>Llm: maskSensitive (email/phone/cc/AWS/api-key)
  Llm->>OAI: POST /chat/completions (json_object, OpenAI-Beta:log-retention=0)
  alt success
    OAI-->>Llm: JSON { industry,size,b2x,...,confidence }
    Llm->>Llm: zod validate EstimationOutputSchema
  else failure / schema mismatch
    Llm->>Llm: ruleBasedEstimate() degraded=true
  end
  Llm-->>RH: EstimationResult

  RH->>Db: company.upsert(tenantId, domain) + tenant-guard
  Db-->>RH: { id }
  RH->>Aud: action='company.upsert' + degraded/provider/confidence
  RH-->>FE: 202 Accepted { id, domain, status, pollUrl }
```

---

## SEQ-2: SSE 進捗ストリーム (companies/stream)

`POST /api/v1/companies/stream`. Cycle 3.4 実装。

```mermaid
sequenceDiagram
  autonumber
  participant FE as Client useEventStream
  participant RH as POST /api/v1/companies/stream
  participant Crw as crawl()
  participant Llm as estimate()
  participant Db as Prisma

  FE->>RH: fetch (Accept: text/event-stream, Last-Event-Id?)
  RH->>RH: requireActionFromRequest('company.create')
  RH->>RH: ReadableStream.start

  RH-->>FE: event: validating / id: validating
  RH->>Crw: crawl(url)
  alt SSRF block
    RH-->>FE: event: error (code: url_blocked)
    RH-->>FE: stream close
  else
    Crw-->>RH: ok
    RH-->>FE: event: crawling / data { finalUrl, hops, title }

    RH->>Llm: estimate(...)
    Llm-->>RH: EstimationResult (degraded?)
    RH-->>FE: event: estimating / data { industry, confidence, degraded, provider }

    RH->>Db: company.upsert + writeAudit
    RH-->>FE: event: persisting / data { companyId }
    RH-->>FE: event: done / data { id, domain, status, degraded, needsManualReview }
  end
  RH-->>FE: stream close
```

`Last-Event-Id` ヘッダで再開時に該当ステージ以降のイベントから再生。

---

## SEQ-3: Assessment 作成 (Idempotency-Key + bulk-insert)

`POST /api/v1/assessments`. Cycle 2.4 実装。

```mermaid
sequenceDiagram
  autonumber
  participant FE as Client
  participant RH as POST /api/v1/assessments
  participant Idem as idempotency store (in-memory)
  participant Db as Prisma transaction

  FE->>RH: POST { companyId, selectedGuidelineIds[], applyBaseline, title }<br/>Idempotency-Key: <key> (任意)
  RH->>RH: requireActionFromRequest('assessment.create')
  RH->>RH: zod parse + Idempotency-Key 形式チェック

  alt key 既存ヒット
    RH->>Idem: get(tenantId, key)
    Idem-->>RH: 前回 response
    RH-->>FE: 200 OK (cached)
  else
    RH->>Db: company.findFirst (tenant-guard)
    Db-->>RH: ok / 404

    RH->>Db: guideline.findMany (selected + applyBaseline) + versions desc + controlItems
    Db-->>RH: rows

    RH->>RH: snapshot[] 構築 + normalized_key で dedupe
    RH->>Db: $transaction:<br/>1) Assessment.create<br/>2) AssessmentGuideline.createMany<br/>3) AssessmentItem.createMany
    Db-->>RH: { id }

    RH->>Idem: set(tenantId, key, response)
    RH->>RH: writeAudit('assessment.create')
    RH-->>FE: 201 Created { id, status, itemCount }
  end
```

---

## SEQ-4: AI チャット (SSE chunk → meta → done)

`POST /api/v1/assessment-items/{id}/ai-chat`. Cycle 3.1 実装。

```mermaid
sequenceDiagram
  autonumber
  participant FE as Client
  participant RH as POST .../ai-chat
  participant Db as Prisma
  participant Llm as streamAiChat
  participant OAI as OpenAI (stream:true)

  FE->>RH: POST { question } (cookie)
  RH->>RH: requireActionFromRequest('ai_chat.ask')
  RH->>RH: zod parse question (≤1000)

  RH->>Db: assessmentItem.findFirst (tenant-guard)<br/>note/evidenceUrl は select に含めない
  Db-->>RH: + ControlItem + GuidelineVersion + Guideline

  RH->>RH: ReadableStream.start (text/event-stream)
  RH->>Llm: streamAiChat({item context, question})
  Llm->>Llm: buildAiChatPrompt + maskSensitive
  Llm->>OAI: POST /chat/completions stream:true

  loop SSE chunks
    OAI-->>Llm: data: {delta:{content}}
    Llm-->>RH: chunk
    RH-->>FE: event: chunk / data {delta}
  end

  Llm->>Llm: sanitizeAiChatMarkdown (XSS)
  RH->>Db: aiChat.create (sanitized answer)
  RH->>RH: writeAudit('ai_chat.create')
  RH-->>FE: event: meta / data { aiChatId, promptVersion, degraded, sanitizationNotes }
  RH-->>FE: event: done / data {}
  RH-->>FE: stream close
```

LLM 不在時 (API key 未設定 / 5xx / abort) は **degraded fallback** メッセージを 1 chunk で返却し、参考リンクを末尾付与。

---

## SEQ-5: 認可フロー (requireActionFromRequest)

```mermaid
sequenceDiagram
  autonumber
  participant Req as HTTP Request
  participant Mid as middleware.ts (Edge)
  participant Sess as getSessionFromRequest
  participant Auth as canPerform(role, action)
  participant Tnt as resolveTenantContext (upsert)
  participant Db as Prisma

  Req->>Mid: cookie sct_session
  Mid->>Mid: jwtVerify (JWKS, iss, aud)
  alt token 不正
    Mid-->>Req: 401 redirect /auth/login
  end

  Req->>Sess: re-verify in route handler<br/>(defense-in-depth)
  Sess-->>Req: SessionUser{ sub, email, orgId, role }

  Req->>Auth: canPerform(role, 'company.create' 等)
  alt allowed
    Auth-->>Req: ok
    Req->>Tnt: resolveTenantContext(user)
    Tnt->>Db: tenant.upsert(externalId=orgId)
    Tnt->>Db: user.upsert(externalId=sub)
    Db-->>Tnt: { tenantId, userId }
    Tnt-->>Req: ok
  else denied
    Auth-->>Req: 403 forbidden + whyNotAllowedJa(role,action)
  end
```

permissions.ts は spec.md §6.2 マトリクスの SSOT。

---

## 関連ドキュメント

- システム構成: [`system.md`](./system.md)
- API リファレンス: [`../api/api-reference.md`](../api/api-reference.md)
- 設計仕様: [`../design/spec.md`](../design/spec.md)

---
*Phase 6 / Cycle 6.2 — Sequence Diagrams (security-checklist-tool)*
