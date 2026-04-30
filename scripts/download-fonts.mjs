#!/usr/bin/env node
/**
 * Phase 7 / Cycle 7.3c: PDF 用日本語フォントの取得スクリプト.
 *
 * pdfkit は TTF/OTF を要求し、Google の web font (woff/woff2) は使えないため、
 * Noto Sans CJK JP の公式 SubsetOTF を GitHub から取得して public/fonts/ に保存する。
 *
 * Usage:
 *   node scripts/download-fonts.mjs
 *
 * Idempotent: 既に存在するファイルはスキップ。
 * License: SIL Open Font License 1.1 (再配布可)。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'fonts');

const FONTS = [
  {
    file: 'NotoSansJP-Regular.otf',
    url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf',
    sha: null, // 将来的に sha256 検証を追加可能
  },
  {
    file: 'NotoSansJP-Bold.otf',
    url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/JP/NotoSansJP-Bold.otf',
    sha: null,
  },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchToFile(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return buf.byteLength;
}

async function main() {
  await ensureDir(OUT_DIR);
  for (const f of FONTS) {
    const dest = path.join(OUT_DIR, f.file);
    if (await exists(dest)) {
      const stat = await fs.stat(dest);
      console.log(`✓ ${f.file} (${stat.size} bytes, cached)`);
      continue;
    }
    process.stdout.write(`↓ ${f.file} ... `);
    try {
      const size = await fetchToFile(f.url, dest);
      console.log(`${size} bytes`);
    } catch (e) {
      console.error(`failed: ${e.message}`);
      console.error(`  hint: 手動で ${f.url} を取得し ${dest} に保存してください`);
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
