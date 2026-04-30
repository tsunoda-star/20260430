import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { problemResponse } from '@/lib/server/problem-details';
import { requireActionFromRequest } from '@/lib/server/session';
import { resolveTenantContext } from '@/lib/server/tenant';
import { prisma } from '@/lib/server/db';
import { AuditQuerySchema, buildAuditWhere } from '@/lib/server/audit-query';

/**
 * GET /api/v1/admin/audit-logs
 * spec.md §3.2 / §6.2 + Cycle 4.2: 監査ログの一覧取得 (Admin/Owner 限定).
 *
 * Query: ?action=&resourceType=&userId=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize=
 * 認可: audit_log.read (owner / admin)
 */

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  const guard = await requireActionFromRequest(req, 'audit_log.read');
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = AuditQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return problemResponse('invalid_input', { errors: parsed.error.flatten() });
  }
  const { tenantId } = await resolveTenantContext(guard.user);
  const { where, skip, take } = buildAuditWhere(tenantId, parsed.data);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { ts: 'desc' },
      skip,
      take,
      select: {
        id: true,
        ts: true,
        action: true,
        resourceType: true,
        resourceId: true,
        beforeValue: true,
        afterValue: true,
        ipAddress: true,
        user: { select: { id: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
    rows: rows.map((r) => ({
      id: r.id.toString(),
      ts: r.ts.toISOString(),
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId?.toString() ?? null,
      beforeValue: r.beforeValue,
      afterValue: r.afterValue,
      ipAddress: r.ipAddress,
      user: r.user
        ? { id: r.user.id.toString(), email: r.user.email, role: r.user.role }
        : null,
    })),
  });
}
