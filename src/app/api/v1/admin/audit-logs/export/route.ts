import type { NextRequest } from 'next/server';
import { stringify } from 'csv-stringify/sync';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { writeAudit } from '@/lib/server/audit';
import { prisma } from '@/lib/server/db';
import { AuditQuerySchema, buildAuditWhere } from '@/lib/server/audit-query';

/**
 * GET /api/v1/admin/audit-logs/export
 * spec.md §3.2 / §4.4 + Cycle 4.2: 監査ログの CSV 同期エクスポート.
 *
 * - 対象は GET /audit-logs と同じフィルタ条件 (page/pageSize は無視、最大 50,000 行)
 * - 認可: audit_log.read (owner / admin)
 * - UTF-8 BOM 付き / RFC4180 / セル長 cap 32k
 */

export const runtime = 'nodejs';

const MAX_ROWS = 50_000;
const CELL_MAX = 32_000;
const BOM = '﻿';

const HEADERS = [
  'Timestamp',
  'Action',
  'ResourceType',
  'ResourceId',
  'UserEmail',
  'UserRole',
  'IpAddress',
  'Before',
  'After',
] as const;

function trim(v: string | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (v.length <= CELL_MAX) return v;
  return `${v.slice(0, CELL_MAX)}…(truncated)`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'audit_log.read');
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = AuditQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }

  const { tenantId, userId } = await resolveTenantContext(guard.user);
  const { where } = buildAuditWhere(tenantId, parsed.data);

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { ts: 'desc' },
    take: MAX_ROWS,
    select: {
      id: true,
      ts: true,
      action: true,
      resourceType: true,
      resourceId: true,
      beforeValue: true,
      afterValue: true,
      ipAddress: true,
      user: { select: { email: true, role: true } },
    },
  });

  const records = rows.map((r) => [
    r.ts.toISOString(),
    trim(r.action),
    trim(r.resourceType),
    trim(r.resourceId?.toString() ?? null),
    trim(r.user?.email ?? null),
    trim(r.user?.role ?? null),
    trim(r.ipAddress ?? null),
    trim(r.beforeValue ? JSON.stringify(r.beforeValue) : null),
    trim(r.afterValue ? JSON.stringify(r.afterValue) : null),
  ]);
  const csvText = stringify([HEADERS as unknown as string[], ...records], {
    quoted_string: true,
    record_delimiter: '\r\n',
  });
  const bytes = new TextEncoder().encode(`${BOM}${csvText}`);

  await writeAudit({
    tenantId,
    userId,
    action: 'audit_log.export',
    resourceType: 'audit_log',
    afterValue: { rows: rows.length, filters: parsed.data },
  });

  // ArrayBuffer 正規化 (Blob 互換)
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return new Response(new Blob([ab], { type: 'text/csv; charset=utf-8' }), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="audit-logs.csv"`,
      'cache-control': 'no-store',
    },
  });
}
