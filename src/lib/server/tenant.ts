import type { SessionUser } from '@/lib/auth/session';
import { prisma } from './db';

/**
 * CC-Auth の org_id (テナント外部ID) と内部 Tenant.id / User.id を結びつける。
 * spec.md §3.1: middleware で JWT から org_id 取得 → Tenant 行に upsert。
 *
 * Cycle 2.4 では存在しなければ自動作成 (provisioning) する簡易版。
 * 監査要件が確定したら invite フローに移管 (Wave 4 / Cycle 4.4)。
 */

export interface TenantContext {
  tenantId: bigint;
  userId: bigint;
}

export async function resolveTenantContext(user: SessionUser): Promise<TenantContext> {
  const tenant = await prisma.tenant.upsert({
    where: { externalId: user.orgId },
    update: {},
    create: { externalId: user.orgId, name: user.orgId },
    select: { id: true },
  });
  const internalUser = await prisma.user.upsert({
    where: { externalId: user.sub },
    update: { email: user.email, name: user.name ?? user.email, role: user.role },
    create: {
      tenantId: tenant.id,
      externalId: user.sub,
      email: user.email,
      name: user.name ?? user.email,
      role: user.role,
    },
    select: { id: true },
  });
  return { tenantId: tenant.id, userId: internalUser.id };
}
