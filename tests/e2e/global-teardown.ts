import * as fs from 'fs';
import * as path from 'path';

/**
 * Cycle 5.3: Playwright global teardown.
 * - storageState を残しつつ、ログ末尾に終了 metadata を追加
 */

export default async function globalTeardown(): Promise<void> {
  const logDir = process.env.TEST_LOG_DIR;
  if (!logDir) return;
  try {
    const meta = path.join(logDir, 'metadata.json');
    let parsed: Record<string, unknown> = {};
    if (fs.existsSync(meta)) {
      parsed = JSON.parse(fs.readFileSync(meta, 'utf-8')) as Record<string, unknown>;
    }
    parsed.endTime = new Date().toISOString();
    fs.writeFileSync(meta, JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.warn('global-teardown failed:', e);
  }
}
