import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { problemResponse } from '@/lib/server/problem-details';
import { requireRoleFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { prisma } from '@/lib/server/db';
import {
  getIdempotent,
  isValidIdempotencyKey,
  setIdempotent,
} from '@/lib/server/idempotency';
import { isDevAuthBypassEnabled } from '@/lib/auth/dev-bypass';

/**
 * POST /api/v1/assessments
 * spec.md §3.3 / §4.1: selectedGuidelineIds + applyBaseline で Assessment を作成。
 *
 * - guideline_version_snapshot を固定 (旧Assessmentは旧版継続)
 * - control_items を normalized_key で重複排除した上で AssessmentItem を bulk-insert
 * - Idempotency-Key (24h) — 同一キー再投入時は前回結果を返す (§9.2)
 * - 認可: editor 以上
 */

export const runtime = 'nodejs';

const RequestSchema = z.object({
  companyId: z.string().regex(/^\d+$/, 'companyId must be a numeric string'),
  selectedGuidelineIds: z
    .array(z.union([z.string().regex(/^\d+$/), z.number().int().positive()]))
    .max(100),
  applyBaseline: z.boolean().default(true),
  title: z.string().trim().min(1).max(255),
});

interface ResponseBody {
  id: string;
  status: 'in_progress';
  itemCount: number;
}

function debugError(stage: string, e: unknown): Response {
  const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const stack = e instanceof Error ? e.stack : undefined;
  console.error(`[assessments POST] ${stage} failed:`, detail, stack);
  if (isDevAuthBypassEnabled()) {
    return new Response(
      JSON.stringify({ debug: true, stage, detail, stack: stack?.split('\n').slice(0, 12) }),
      { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }
  return new Response('Internal Server Error', { status: 500 });
}

export async function POST(req: NextRequest): Promise<Response> {
  let stage = 'auth';
  try {
  const guard = await requireRoleFromRequest(req, 'editor');
  if (!guard.ok) return guard.response;

  stage = 'parse-body';
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  stage = 'resolve-tenant';
  const { tenantId, userId } = await resolveTenantContext(guard.user);
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey !== null && !isValidIdempotencyKey(idempotencyKey)) {
    return problemResponse('invalid_input', {
      detail: 'Idempotency-Key is malformed',
    });
  }
  if (idempotencyKey) {
    const cached = getIdempotent<ResponseBody>(tenantId, idempotencyKey);
    if (cached) return NextResponse.json(cached, { status: 200 });
  }

  stage = 'company-lookup';
  // 1) Company tenant check
  const companyIdBig = BigInt(parsed.data.companyId);
  const company = await prisma.company.findFirst({
    where: { id: companyIdBig, tenantId },
    select: { id: true, industry: true },
  });
  if (!company) return problemResponse('not_found', { detail: 'company' });

  // 2) 対象 GuidelineVersion を解決:
  //    selectedGuidelineIds は guideline.id で受け、最新 version を採用 (snapshot 用)。
  //    applyBaseline 時は is_baseline=true を補完。
  const selectedIds = Array.from(
    new Set(parsed.data.selectedGuidelineIds.map((v) => BigInt(v).toString())),
  ).map((s) => BigInt(s));

  const baselineIds = parsed.data.applyBaseline
    ? (
        await prisma.guideline.findMany({
          where: { isBaseline: true, isActive: true },
          select: { id: true },
        })
      ).map((g) => g.id)
    : [];

  const allIds = Array.from(
    new Set([...selectedIds, ...baselineIds].map((b) => b.toString())),
  ).map((s) => BigInt(s));

  if (allIds.length === 0) {
    return problemResponse('invalid_input', {
      detail: 'no guidelines selected and applyBaseline is false',
    });
  }

  stage = 'guideline-fetch';
  // 各 guideline の最新 version (released_at desc) を 1 件ずつ取得
  const guidelinesWithVersions = await prisma.guideline.findMany({
    where: { id: { in: allIds }, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      versions: {
        orderBy: { releasedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          version: true,
          releasedAt: true,
          controlItems: {
            select: {
              id: true,
              normalizedKey: true,
              priority: true,
            },
          },
        },
      },
    },
  });

  if (guidelinesWithVersions.length === 0) {
    return problemResponse('not_found', { detail: 'no matching guidelines' });
  }

  // 3) snapshot + normalized_key dedup
  const snapshot = guidelinesWithVersions.map((g) => {
    const v = g.versions[0];
    return {
      guidelineId: g.id.toString(),
      code: g.code,
      name: g.name,
      versionId: v?.id.toString() ?? null,
      version: v?.version ?? null,
      releasedAt: v?.releasedAt?.toISOString() ?? null,
    };
  });

  const seenKeys = new Set<string>();
  const itemSeeds: { controlItemId: bigint; priority: number }[] = [];
  for (const g of guidelinesWithVersions) {
    const v = g.versions[0];
    if (!v) continue;
    for (const ci of v.controlItems) {
      if (seenKeys.has(ci.normalizedKey)) continue;
      seenKeys.add(ci.normalizedKey);
      itemSeeds.push({ controlItemId: ci.id, priority: ci.priority });
    }
  }

  stage = 'create-assessment';
  // 4) Assessment + AssessmentGuideline + AssessmentItem を順次作成。
  //    @prisma/adapter-neon (Pool) は $transaction で pool.connect() 経由の
  //    WebSocket 接続を張るが、Plesk が WebSocket を遮断するため使えない。
  //    各 create/createMany を単発で実行 (HTTPS pool.query)。
  //    途中失敗時はサーバ側にゴミが残るが、idempotency-key の再投入で補正される。
  const a = await prisma.assessment.create({
    data: {
      tenantId,
      companyId: company.id,
      title: parsed.data.title,
      status: 'in_progress',
      baselineApplied: parsed.data.applyBaseline,
      guidelineVersionSnapshot: snapshot as unknown as object,
      selectionRationale: null,
      createdById: userId,
    },
    select: { id: true },
  });

  const links = guidelinesWithVersions
    .map((g) => g.versions[0])
    .filter((v): v is NonNullable<typeof v> => v !== undefined)
    .map((v) => ({
      assessmentId: a.id,
      guidelineVersionId: v.id,
      addedBy:
        parsed.data.selectedGuidelineIds.length > 0
          ? ('manual' as const)
          : ('auto' as const),
    }));
  // Plesk の WebSocket 遮断下で確実に動かすため、bulk INSERT を生 SQL で
  // 1 文に固める。$executeRawUnsafe は pool.query() (HTTPS) で実行される。
  // (Prisma の createMany / 個別 create は内部で transaction を張るパスに
  //  入ることがあり、その場合 WebSocket 接続を要求して "Connection
  //  terminated unexpectedly" になる)
  stage = 'create-links';
  if (links.length > 0) {
    const linkValues = links
      .map(
        (l) =>
          `(${l.assessmentId.toString()}, ${l.guidelineVersionId.toString()}, '${l.addedBy}')`,
      )
      .join(', ');
    await prisma.$executeRawUnsafe(
      `INSERT INTO "assessment_guidelines" ("assessment_id", "guideline_version_id", "added_by") VALUES ${linkValues}`,
    );
  }
  stage = 'create-items';
  if (itemSeeds.length > 0) {
    const itemValues = itemSeeds
      .map(
        (s) =>
          `(${tenantId.toString()}, ${a.id.toString()}, ${s.controlItemId.toString()}, 'open')`,
      )
      .join(', ');
    await prisma.$executeRawUnsafe(
      `INSERT INTO "assessment_items" ("tenant_id", "assessment_id", "control_item_id", "status") VALUES ${itemValues}`,
    );
  }
  const created = { id: a.id };

  stage = 'audit';
  await writeAudit({
    tenantId,
    userId,
    action: 'assessment.create',
    resourceType: 'assessment',
    resourceId: created.id,
    afterValue: {
      title: parsed.data.title,
      itemCount: itemSeeds.length,
      applyBaseline: parsed.data.applyBaseline,
      guidelineCount: guidelinesWithVersions.length,
    },
  });

  const response: ResponseBody = {
    id: created.id.toString(),
    status: 'in_progress',
    itemCount: itemSeeds.length,
  };
  if (idempotencyKey) {
    setIdempotent(tenantId, idempotencyKey, response);
  }
  return NextResponse.json(response, { status: 201 });
  } catch (e) {
    return debugError(stage, e);
  }
}
