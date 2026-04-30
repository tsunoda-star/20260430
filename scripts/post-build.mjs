#!/usr/bin/env node
/**
 * Phase 7 / Cycle 7.6: post-build hook.
 *
 * Next.js standalone は .next/standalone/ に server.js を生成するが、
 * 静的ファイル (.next/static / public) は別途コピーする必要がある。
 *
 * `npm run build` 後に自動実行される (package.json scripts.postbuild)。
 *
 * 実行内容:
 *   1. .next/standalone/.next/static ← .next/static
 *   2. .next/standalone/public        ← public
 *   3. tmp/restart.txt touch (Phusion Passenger graceful restart)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(from, to) {
  if (!(await exists(from))) {
    console.warn(`(skip) ${from} does not exist`);
    return;
  }
  await fs.rm(to, { recursive: true, force: true });
  await fs.cp(from, to, { recursive: true });
  console.log(`✓ copied ${path.relative(ROOT, from)} → ${path.relative(ROOT, to)}`);
}

async function main() {
  const standalone = path.join(ROOT, '.next', 'standalone');
  if (!(await exists(standalone))) {
    console.warn(
      '(skip) .next/standalone not found — set output: "standalone" in next.config.mjs',
    );
    return;
  }
  await copyDir(
    path.join(ROOT, '.next', 'static'),
    path.join(standalone, '.next', 'static'),
  );
  await copyDir(path.join(ROOT, 'public'), path.join(standalone, 'public'));

  const tmp = path.join(ROOT, 'tmp');
  await fs.mkdir(tmp, { recursive: true });
  await fs.writeFile(path.join(tmp, 'restart.txt'), '');
  console.log('✓ tmp/restart.txt touched (Phusion Passenger restart trigger)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
