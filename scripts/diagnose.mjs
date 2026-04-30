#!/usr/bin/env node
/**
 * Plesk Run Script から `diagnose` で実行する診断ツール.
 * 500 エラーの根本原因を特定するため、各レイヤを順に検証する.
 *
 *   npm run diagnose
 *
 * 出力は Plesk の Run Script ダイアログにそのまま出る (短時間で完了)。
 */

const log = (...a) => console.log(...a);
const err = (label, e) => {
  console.error(`✗ ${label}:`);
  console.error(e?.stack ?? e?.message ?? e);
};

log('=== Environment ===');
log('Node:', process.version);
log('CWD:', process.cwd());
log('NODE_ENV:', process.env.NODE_ENV);
log('USE_NEON_HTTPS:', process.env.USE_NEON_HTTPS);
log('DATABASE_URL set:', !!process.env.DATABASE_URL);
log(
  'DATABASE_URL prefix:',
  (process.env.DATABASE_URL ?? '').slice(0, 50) + '...',
);
log('LLM_PRIMARY_PROVIDER:', process.env.LLM_PRIMARY_PROVIDER);

log('\n=== Module load test ===');
async function tryLoad(name) {
  try {
    await import(name);
    log(`✓ ${name}`);
    return true;
  } catch (e) {
    err(name, e);
    return false;
  }
}
await tryLoad('@prisma/client');
await tryLoad('@prisma/adapter-neon');
await tryLoad('@neondatabase/serverless');
await tryLoad('ws');
await tryLoad('undici');

log('\n=== Standalone build presence ===');
import { promises as fs } from 'node:fs';
import path from 'node:path';
const cwd = process.cwd();
for (const p of [
  '.next/standalone/server.js',
  '.next/standalone/.next/static',
  '.next/standalone/public',
  '.next/static',
  'public',
  'node_modules/@prisma/client',
  'node_modules/@prisma/adapter-neon',
  'node_modules/@neondatabase/serverless',
]) {
  try {
    const stat = await fs.stat(path.join(cwd, p));
    log(`✓ ${p} (${stat.isDirectory() ? 'dir' : 'file'})`);
  } catch {
    log(`✗ ${p} MISSING`);
  }
}

log('\n=== Neon HTTPS DB test ===');
try {
  const { neonConfig, Pool } = await import('@neondatabase/serverless');
  const { default: ws } = await import('ws');
  neonConfig.webSocketConstructor = ws;
  neonConfig.poolQueryViaFetch = true;
  const { PrismaNeon } = await import('@prisma/adapter-neon');
  const { PrismaClient } = await import('@prisma/client');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });
  const start = Date.now();
  const r = await prisma.$queryRaw`SELECT 1 as ok`;
  log(`✓ Neon HTTPS query OK (${Date.now() - start}ms)`, r);

  log('\n=== Schema presence (Tenant / User / Company) ===');
  for (const table of ['Tenant', 'User', 'Company', 'GuidelineVersion']) {
    try {
      const cnt = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM "${table}"`,
      );
      log(`✓ ${table} exists (rows=${cnt?.[0]?.n ?? '?'})`);
    } catch (e) {
      log(`✗ ${table}: ${e?.message?.split('\n')[0] ?? e}`);
    }
  }

  log('\n=== Tenant upsert smoke test (mimics resolveTenantContext) ===');
  try {
    const t = await prisma.tenant.upsert({
      where: { externalId: 'dev-tenant' },
      update: {},
      create: { externalId: 'dev-tenant', name: 'dev-tenant' },
      select: { id: true, externalId: true },
    });
    log(`✓ tenant.upsert OK id=${t.id} externalId=${t.externalId}`);
    const u = await prisma.user.upsert({
      where: { externalId: 'dev-user-001' },
      update: {},
      create: {
        tenantId: t.id,
        externalId: 'dev-user-001',
        email: 'dev@local.example',
        name: 'Dev User',
        role: 'admin',
      },
      select: { id: true },
    });
    log(`✓ user.upsert OK id=${u.id}`);
  } catch (e) {
    err('Tenant/User upsert', e);
  }
  await prisma.$disconnect();
} catch (e) {
  err('Neon HTTPS connect', e);
}

log('\n=== Done ===');
