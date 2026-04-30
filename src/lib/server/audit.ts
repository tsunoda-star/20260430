import { Prisma } from '@prisma/client';
import { prisma } from './db';

/**
 * AuditLog 書き込みヘルパー。
 * spec.md §2: 全 mutating 操作 + SSRF block 等の重要イベントは AuditLog に残す。
 *
 * 失敗しても業務処理を巻き込まないよう, try/catch で握りつぶし console.warn する。
 */

export interface AuditInput {
  tenantId: bigint;
  userId: bigint | null;
  action: string;
  resourceType: string;
  resourceId?: bigint | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  ipAddress?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        beforeValue:
          input.beforeValue === undefined
            ? undefined
            : (input.beforeValue as Prisma.InputJsonValue),
        afterValue:
          input.afterValue === undefined
            ? undefined
            : (input.afterValue as Prisma.InputJsonValue),
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (e) {
    console.warn('[audit] failed to write log:', e);
  }
}
