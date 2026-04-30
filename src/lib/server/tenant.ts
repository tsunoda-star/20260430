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

/**
 * @prisma/adapter-neon (Pool) は upsert / transaction の際に
 * pool.connect() で WebSocket 接続を張るが、一部ホスティング (Pro-Web Plesk 等)
 * は WebSocket upgrade を遮断するため "Connection terminated unexpectedly"
 * になる。pool.query() のみ poolQueryViaFetch=true で HTTPS フォールバック
 * できるので、upsert を分解して単発クエリ (findUnique → create / update) に
 * 置き換える。
 */
export async function resolveTenantContext(user: SessionUser): Promise<TenantContext> {
  let tenant = await prisma.tenant.findUnique({
    where: { externalId: user.orgId },
    select: { id: true },
  });
  if (!tenant) {
    try {
      tenant = await prisma.tenant.create({
        data: { externalId: user.orgId, name: user.orgId },
        select: { id: true },
      });
    } catch {
      // 並行で別リクエストが create した場合に unique 制約違反になるが、
      // その場合は findUnique で再取得すれば済む。
      tenant = await prisma.tenant.findUnique({
        where: { externalId: user.orgId },
        select: { id: true },
      });
      if (!tenant) throw new Error('tenant_resolve_failed');
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { externalId: user.sub },
    select: { id: true },
  });
  let internalUserId: bigint;
  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { email: user.email, name: user.name ?? user.email, role: user.role },
    });
    internalUserId = existingUser.id;
  } else {
    try {
      const created = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          externalId: user.sub,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
        },
        select: { id: true },
      });
      internalUserId = created.id;
    } catch {
      const refetched = await prisma.user.findUnique({
        where: { externalId: user.sub },
        select: { id: true },
      });
      if (!refetched) throw new Error('user_resolve_failed');
      internalUserId = refetched.id;
    }
  }
  return { tenantId: tenant.id, userId: internalUserId };
}
