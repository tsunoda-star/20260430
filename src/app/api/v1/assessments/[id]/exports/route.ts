import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { exportAssessment } from '@/lib/server/exporters';
import { loadAssessmentExportData } from '@/lib/server/exporters/loader';

/**
 * POST /api/v1/assessments/:id/exports
 * spec.md §3.2 / §4.4 / Cycle 4.1: Excel/PDF/CSV を同期生成して返す.
 *
 * 認可: export.run (全ロール — viewer 含む)
 * Body:  { format: 'xlsx' | 'pdf' | 'csv' }
 *
 * Wave 4 では同期生成 (短時間 < 10s 想定) — 大規模 Assessment や
 * S3+SQS 化は将来 Cycle で対応 (本実装は in-process / streaming response)。
 */

export const runtime = 'nodejs';

const RequestSchema = z.object({
  format: z.enum(['xlsx', 'pdf', 'csv']),
});

function parseId(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'export.run');
  if (!guard.ok) return guard.response;

  const id = parseId(ctx.params.id);
  if (id === null) return problemResponse('not_found');

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  const { tenantId, userId } = await resolveTenantContext(guard.user);

  const data = await loadAssessmentExportData({ tenantId, assessmentId: id });
  if (!data) return problemResponse('not_found');

  let artifact;
  try {
    artifact = await exportAssessment(parsed.data.format, data);
  } catch (e) {
    return problemResponse('upstream_error', {
      detail: e instanceof Error ? e.message : 'export failed',
    });
  }

  await writeAudit({
    tenantId,
    userId,
    action: 'export.run',
    resourceType: 'assessment',
    resourceId: id,
    afterValue: {
      format: artifact.format,
      filename: artifact.filename,
      bytes: artifact.body.byteLength,
      itemCount: data.rows.length,
    },
  });

  // Uint8Array<ArrayBufferLike> を ArrayBuffer に正規化 (TS 5.7+ 厳格化対応)
  const ab = new ArrayBuffer(artifact.body.byteLength);
  new Uint8Array(ab).set(artifact.body);
  return new Response(new Blob([ab], { type: artifact.contentType }), {
    status: 200,
    headers: {
      'content-type': artifact.contentType,
      'content-disposition': `attachment; filename="${artifact.filename}"`,
      'cache-control': 'no-store',
    },
  });
}
