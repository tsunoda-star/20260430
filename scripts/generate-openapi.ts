/**
 * Phase 6 / Cycle 6.1: OpenAPI 3.1 generator.
 *
 * 既存の zod schema を OpenAPIRegistry に登録し、docs/api/openapi.json を出力。
 * 全 18 API ルートをカバー (Phase 4 / Wave 2-4 で実装済の API 一式)。
 *
 * Run:
 *   npx tsx scripts/generate-openapi.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

/* -------------------------------------------------------------------------- */
/*                              Reusable schemas                               */
/* -------------------------------------------------------------------------- */

const ProblemDetailSchema = z
  .object({
    type: z.string().openapi({ example: 'urn:problem:sct:invalid_input' }),
    title: z.string().openapi({ example: 'Invalid input' }),
    status: z.number().int().openapi({ example: 400 }),
    detail: z.string().optional(),
    instance: z.string().optional(),
    errors: z.unknown().optional(),
  })
  .openapi('ProblemDetail', {
    description: 'RFC 7807 Problem Details for HTTP APIs',
  });

const RoleSchema = z
  .enum(['owner', 'admin', 'editor', 'reviewer', 'viewer'])
  .openapi('Role');

const StatusSchema = z
  .enum(['open', 'in_progress', 'done', 'not_applicable'])
  .openapi('AssessmentItemStatus');

const IndustrySchema = z
  .enum([
    'medical-saas',
    'manufacturing',
    'finance',
    'retail',
    'public-sector',
    'automotive',
    'logistics',
    'education',
    'real-estate',
    'media',
    'it-services',
    'professional-services',
    'energy',
    'agriculture',
    'unknown',
  ])
  .openapi('Industry');

const EstimationOutputSchema = z
  .object({
    industry: IndustrySchema,
    size: z.enum(['sme', 'midsize', 'enterprise']),
    b2x: z.enum(['b2b', 'b2c', 'b2g', 'mixed']),
    handles_personal_info: z.boolean(),
    handles_payment: z.boolean(),
    confidence: z.number().int().min(0).max(100),
    rationale: z.string().max(200),
  })
  .openapi('EstimationOutput');

const MeResponseSchema = z
  .object({
    sub: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    orgId: z.string(),
    role: RoleSchema,
    permissions: z.array(z.string()),
  })
  .openapi('MeResponse');

const CompanyResponseSchema = z
  .object({
    id: z.string(),
    domain: z.string(),
    displayName: z.string().nullable(),
    industry: z.string().nullable(),
    size: z.string().nullable(),
    inferredData: z.unknown(),
    inferenceConfidence: z.number().int().nullable(),
    userOverrides: z.unknown(),
    createdAt: z.string().datetime(),
  })
  .openapi('Company');

const CompanyAcceptedSchema = z
  .object({
    id: z.string(),
    domain: z.string(),
    status: z.enum(['analyzing', 'completed']),
    pollUrl: z.string(),
  })
  .openapi('CompanyAccepted');

const SuggestionsResponseSchema = z
  .object({
    inferredIndustry: IndustrySchema,
    rerank: z.object({
      applied: z.boolean(),
      degraded: z.boolean(),
      provider: z.string(),
    }),
    baseline: z.array(z.unknown()),
    industryMatch: z.array(z.unknown()),
  })
  .openapi('GuidelineSuggestions');

const AssessmentCreateRequestSchema = z
  .object({
    companyId: z.string().regex(/^\d+$/),
    selectedGuidelineIds: z.array(z.union([z.string(), z.number()])).max(100),
    applyBaseline: z.boolean().default(true),
    title: z.string().min(1).max(255),
  })
  .openapi('AssessmentCreateRequest');

const AssessmentCreateResponseSchema = z
  .object({
    id: z.string(),
    status: z.literal('in_progress'),
    itemCount: z.number().int(),
  })
  .openapi('AssessmentCreateResponse');

const AssessmentItemPatchSchema = z
  .object({
    status: StatusSchema.optional(),
    note: z.string().max(8000).optional(),
    assigneeId: z.string().regex(/^\d+$/).nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    evidenceUrl: z.string().url().max(2048).nullable().optional(),
  })
  .openapi('AssessmentItemPatch');

const ExportRequestSchema = z
  .object({ format: z.enum(['xlsx', 'pdf', 'csv']) })
  .openapi('ExportRequest');

const RatingRequestSchema = z
  .object({ rating: z.enum(['good', 'bad']) })
  .openapi('RatingRequest');

const InviteRequestSchema = z
  .object({
    email: z.string().email().max(320),
    role: RoleSchema,
    message: z.string().max(1000).optional(),
  })
  .openapi('InviteRequest');

const InviteResponseSchema = z
  .object({
    email: z.string().email(),
    role: RoleSchema,
    token: z.string(),
    inviteUrl: z.string(),
    expiresAt: z.string().datetime(),
  })
  .openapi('InviteResponse');

const RoleUpdateRequestSchema = z
  .object({
    role: RoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .openapi('RoleUpdateRequest');

const GuidelineImportItemSchema = z
  .object({
    code: z.string().max(64),
    name: z.string().max(255),
    issuer: z.string().max(128),
    category: z.string().max(32),
    domainTags: z.array(z.string()).default([]),
    isBaseline: z.boolean().default(false),
    sourceUrl: z.string().url().nullable().optional(),
  })
  .openapi('GuidelineImportItem');

const GuidelineImportResponseSchema = z
  .object({
    format: z.enum(['json', 'csv']),
    total: z.number().int(),
    created: z.number().int(),
    updated: z.number().int(),
  })
  .openapi('GuidelineImportResponse');

const AuditLogRowSchema = z
  .object({
    id: z.string(),
    ts: z.string().datetime(),
    action: z.string(),
    resourceType: z.string(),
    resourceId: z.string().nullable(),
    beforeValue: z.unknown(),
    afterValue: z.unknown(),
    ipAddress: z.string().nullable(),
    user: z
      .object({ id: z.string(), email: z.string().email(), role: RoleSchema })
      .nullable(),
  })
  .openapi('AuditLogRow');

const AuditLogPageSchema = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    rows: z.array(AuditLogRowSchema),
  })
  .openapi('AuditLogPage');

const DashboardSchema = z
  .object({
    assessmentId: z.string(),
    title: z.string(),
    status: z.string(),
    totalCount: z.number().int(),
    statusCounts: z.record(z.string(), z.number().int()),
    completionRate: z.number(),
    overdueCount: z.number().int(),
    categories: z.array(
      z.object({
        category: z.string(),
        total: z.number().int(),
        done: z.number().int(),
        byStatus: z.record(z.string(), z.number().int()),
      }),
    ),
  })
  .openapi('Dashboard');

const ReviewerAssignmentsSchema = z
  .object({
    role: RoleSchema,
    items: z.array(
      z.object({
        id: z.string(),
        assessmentId: z.string(),
        assessmentTitle: z.string(),
        controlTitle: z.string(),
        category: z.string(),
        guidelineName: z.string(),
        guidelineVersion: z.string(),
        updatedAt: z.string().datetime(),
      }),
    ),
  })
  .openapi('ReviewerAssignments');

const LatestVersionSchema = z
  .object({
    latestReleasedAt: z.string().datetime().nullable(),
    latestVersion: z.string().nullable(),
    activeGuidelineVersions: z.number().int(),
  })
  .openapi('LatestVersion');

/* -------------------------------------------------------------------------- */
/*                              Security scheme                                */
/* -------------------------------------------------------------------------- */

registry.registerComponent('securitySchemes', 'sessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'sct_session',
  description: 'CC-Auth (Cognito) ID token を httpOnly cookie で保持',
});

const SECURITY = [{ sessionCookie: [] }];

const STD_RESPONSES = {
  401: {
    description: 'Unauthorized',
    content: { 'application/problem+json': { schema: ProblemDetailSchema } },
  },
  403: {
    description: 'Forbidden',
    content: { 'application/problem+json': { schema: ProblemDetailSchema } },
  },
  404: {
    description: 'Not Found',
    content: { 'application/problem+json': { schema: ProblemDetailSchema } },
  },
};

/* -------------------------------------------------------------------------- */
/*                               Path registry                                 */
/* -------------------------------------------------------------------------- */

registry.registerPath({
  method: 'get',
  path: '/api/v1/me',
  description: '現在のセッションユーザーと許可操作一覧を返す',
  tags: ['session'],
  security: SECURITY,
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: MeResponseSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me/reviewer-assignments',
  description: 'Reviewer (および上位ロール) の確認待ち項目一覧',
  tags: ['session'],
  security: SECURITY,
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: ReviewerAssignmentsSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/companies',
  description: 'URL投入 → SSRF safe crawl → LLM 推定 → upsert (editor 以上)',
  tags: ['companies'],
  security: SECURITY,
  request: {
    body: {
      content: {
        'application/json': { schema: z.object({ url: z.string().url() }) },
      },
    },
  },
  responses: {
    202: {
      description: 'Accepted (推定完了)',
      content: { 'application/json': { schema: CompanyAcceptedSchema } },
    },
    422: {
      description: 'URL Blocked (SSRF / 不正 URL)',
      content: { 'application/problem+json': { schema: ProblemDetailSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/companies/stream',
  description: '同上を SSE でステージ毎にイベント配信 (validating/crawling/estimating/persisting/done)',
  tags: ['companies', 'sse'],
  security: SECURITY,
  request: {
    body: {
      content: {
        'application/json': { schema: z.object({ url: z.string().url() }) },
      },
    },
  },
  responses: {
    200: {
      description: 'text/event-stream',
      content: { 'text/event-stream': { schema: z.string() } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/companies/{id}',
  description: 'Company プロフィール取得 (推定根拠含む)',
  tags: ['companies'],
  security: SECURITY,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: CompanyResponseSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/companies/{id}/guideline-suggestions',
  description: 'baseline + industry-match candidates + LLM rerank',
  tags: ['companies', 'guidelines'],
  security: SECURITY,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: SuggestionsResponseSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/assessments',
  description: 'Assessment 作成 (Idempotency-Key 24h / snapshot 凍結 / bulk-insert)',
  tags: ['assessments'],
  security: SECURITY,
  request: {
    headers: z.object({ 'Idempotency-Key': z.string().optional() }),
    body: {
      content: {
        'application/json': { schema: AssessmentCreateRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: AssessmentCreateResponseSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/assessment-items/{id}',
  description: 'AssessmentItem 更新 (reviewer は status=done で note 追記のみ)',
  tags: ['assessment-items'],
  security: SECURITY,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { 'application/json': { schema: AssessmentItemPatchSchema } },
    },
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.unknown() } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/assessment-items/{id}/ai-chat',
  description: 'AI チャット (SSE chunk → meta → done). Markdown XSS サニタイズ済',
  tags: ['ai-chat', 'sse'],
  security: SECURITY,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ question: z.string().min(1).max(1000) }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'text/event-stream',
      content: { 'text/event-stream': { schema: z.string() } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/ai-chats/{id}/rating',
  description: 'AI 回答に Good/Bad 評価を記録',
  tags: ['ai-chat'],
  security: SECURITY,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: RatingRequestSchema } } },
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.unknown() } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/assessments/{id}/exports',
  description: 'Excel / PDF / CSV を同期生成 (export.run)',
  tags: ['assessments', 'exports'],
  security: SECURITY,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ExportRequestSchema } } },
  },
  responses: {
    200: {
      description: 'バイナリ (xlsx / pdf / csv)',
      content: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
          schema: z.string(),
        },
        'application/pdf': { schema: z.string() },
        'text/csv': { schema: z.string() },
      },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/assessments/{id}/dashboard',
  description: '集計 (進捗率 / 期限超過 / カテゴリ別ヒートマップ)',
  tags: ['assessments', 'dashboard'],
  security: SECURITY,
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: DashboardSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/admin/users/invite',
  description: 'ユーザー招待トークン発行 (24h TTL / owner 招待は owner のみ)',
  tags: ['admin', 'users'],
  security: SECURITY,
  request: {
    body: { content: { 'application/json': { schema: InviteRequestSchema } } },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: InviteResponseSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/admin/users/{id}',
  description: 'ロール変更 / 自分降格不可 / 最後の owner 降格不可',
  tags: ['admin', 'users'],
  security: SECURITY,
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: RoleUpdateRequestSchema } } },
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.unknown() } },
    },
    409: {
      description: 'Conflict (最後の owner / 自分降格)',
      content: { 'application/problem+json': { schema: ProblemDetailSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/admin/guidelines/import',
  description: 'ガイドライン一括 import (CSV / JSON / 1..500 records / 2MB cap)',
  tags: ['admin', 'master'],
  security: SECURITY,
  request: {
    body: {
      content: {
        'application/json': { schema: z.array(GuidelineImportItemSchema) },
        'text/csv': { schema: z.string() },
      },
    },
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: GuidelineImportResponseSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/admin/audit-logs',
  description: '監査ログ一覧 (action / resourceType / userId / from / to / page / pageSize)',
  tags: ['admin', 'audit'],
  security: SECURITY,
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AuditLogPageSchema } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/admin/audit-logs/export',
  description: '監査ログ CSV エクスポート (max 50,000 行 / UTF-8 BOM)',
  tags: ['admin', 'audit', 'exports'],
  security: SECURITY,
  responses: {
    200: {
      description: 'text/csv',
      content: { 'text/csv': { schema: z.string() } },
    },
    ...STD_RESPONSES,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/master/latest-version',
  description: '最新の有効ガイドライン版 (MasterUpdateBanner 用)',
  tags: ['master'],
  security: SECURITY,
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: LatestVersionSchema } },
    },
    ...STD_RESPONSES,
  },
});

/* -------------------------------------------------------------------------- */
/*                              Generation                                     */
/* -------------------------------------------------------------------------- */

const generator = new OpenApiGeneratorV31(registry.definitions);
const document = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'security-checklist-tool API',
    version: '1.0.0',
    description:
      'Phase 4 / Wave 1-4 実装 21 ルートのうち REST + SSE 系 18 ルートの OpenAPI 3.1 リファレンス. セッションは sct_session cookie (CC-Auth Cognito ID token).',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'local dev' },
    { url: 'https://security-checklist-tool-dev.aidreams-factory.com', description: 'dev' },
    { url: 'https://security-checklist-tool.aidreams-factory.com', description: 'prod' },
  ],
});

const outDir = path.resolve(__dirname, '..', 'docs', 'api');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'openapi.json');
fs.writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

// eslint-disable-next-line no-console
console.log(`✓ generated ${outPath}`);
// eslint-disable-next-line no-console
console.log(`  paths: ${Object.keys(document.paths ?? {}).length}`);
