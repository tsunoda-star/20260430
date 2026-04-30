import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { prisma } from '@/lib/server/db';
import { parseGuidelineImport } from '@/lib/server/guideline-import';

/**
 * POST /api/v1/admin/guidelines/import
 * spec.md §3.2 + Cycle 4.4: ガイドラインマスタ一括 import (CSV / JSON).
 *
 * - 認可: master.update (owner / admin)
 * - 入力サイズ cap 2MB / レコード数 cap 500 (zod 側)
 * - upsert: code 一致で update、不在なら create
 * - GuidelineVersion(v1.0) は seed と同じ規約で同期 (changelog 'imported')
 */

export const runtime = 'nodejs';

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'master.update');
  if (!guard.ok) return guard.response;

  const ct = req.headers.get('content-type') ?? '';
  const text = await req.text();
  if (text.length > MAX_BYTES) {
    return problemResponse('invalid_input', {
      detail: `payload too large (>${MAX_BYTES}bytes)`,
    });
  }

  let parsed;
  try {
    parsed = parseGuidelineImport(text, ct);
  } catch (e) {
    return problemResponse('invalid_input', {
      detail: e instanceof Error ? e.message : 'parse failed',
    });
  }

  const { tenantId, userId } = await resolveTenantContext(guard.user);

  // upsert を順次実行 (DB ラウンドトリップ N 回; 規模は最大 500 で許容)
  const releasedAt = new Date();
  let created = 0;
  let updated = 0;
  for (const g of parsed.records) {
    const before = await prisma.guideline.findUnique({
      where: { code: g.code },
      select: { id: true },
    });
    const guideline = await prisma.guideline.upsert({
      where: { code: g.code },
      update: {
        name: g.name,
        issuer: g.issuer,
        category: g.category,
        domainTags: g.domainTags,
        sourceUrl: g.sourceUrl ?? null,
        isBaseline: g.isBaseline,
        isActive: true,
      },
      create: {
        code: g.code,
        name: g.name,
        issuer: g.issuer,
        category: g.category,
        domainTags: g.domainTags,
        sourceUrl: g.sourceUrl ?? null,
        isBaseline: g.isBaseline,
        isActive: true,
      },
      select: { id: true },
    });
    await prisma.guidelineVersion.upsert({
      where: { guidelineId_version: { guidelineId: guideline.id, version: 'v1.0' } },
      update: { releasedAt, changelog: 'imported via /admin/guidelines/import' },
      create: {
        guidelineId: guideline.id,
        version: 'v1.0',
        schemaHash: g.code.padEnd(64, '0').slice(0, 64),
        releasedAt,
        changelog: 'imported via /admin/guidelines/import',
      },
    });
    if (before) updated += 1;
    else created += 1;
  }

  await writeAudit({
    tenantId,
    userId,
    action: 'master.guidelines_import',
    resourceType: 'guideline',
    resourceId: null,
    afterValue: { format: parsed.format, total: parsed.records.length, created, updated },
  });

  return NextResponse.json({
    format: parsed.format,
    total: parsed.records.length,
    created,
    updated,
  });
}
