import { z } from 'zod';

/**
 * spec.md §3.2 / Cycle 4.2: AuditLog 一覧クエリの zod 検証 + Prisma where 構築.
 *
 * - tenantId は呼び出し側で付与する責務 (本ファイルでは持たない)
 * - filter: action / resourceType / userId / from / to (date) / page / pageSize
 * - 最大 pageSize=200 (DoS ガード)
 */

export const AuditQuerySchema = z.object({
  action: z.string().min(1).max(64).optional(),
  resourceType: z.string().min(1).max(32).optional(),
  userId: z.string().regex(/^\d+$/).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD')
    .optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type AuditQueryInput = z.input<typeof AuditQuerySchema>;
export type AuditQuery = z.output<typeof AuditQuerySchema>;

export interface PrismaAuditWhere {
  tenantId: bigint;
  action?: string;
  resourceType?: string;
  userId?: bigint;
  ts?: { gte?: Date; lte?: Date };
}

/** Query → Prisma where (+ skip/take) を構築 */
export function buildAuditWhere(
  tenantId: bigint,
  q: AuditQuery,
): { where: PrismaAuditWhere; skip: number; take: number } {
  const where: PrismaAuditWhere = { tenantId };
  if (q.action) where.action = q.action;
  if (q.resourceType) where.resourceType = q.resourceType;
  if (q.userId) where.userId = BigInt(q.userId);
  if (q.from || q.to) {
    where.ts = {};
    if (q.from) where.ts.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) where.ts.lte = new Date(`${q.to}T23:59:59.999Z`);
  }
  return { where, skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}
