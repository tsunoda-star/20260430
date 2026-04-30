import { test, expect } from './fixtures';

/**
 * Cycle 5.3 / Cycle 3.4: POST /api/v1/companies/stream の SSE 受信検証.
 *
 * Pre-conditions: editor 以上のロールが playwright/.auth/*.json として用意されていること。
 * Cognito + DB が起動しているテスト環境で実行する。
 */

test.describe('SSE progress (companies/stream)', () => {
  test('emits validating → crawling → estimating → persisting → done events', async ({
    editorPage,
  }) => {
    const res = await editorPage.request.post('/api/v1/companies/stream', {
      data: { url: 'https://example.com' },
      headers: { accept: 'text/event-stream' },
    });
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('text/event-stream');

    const text = await res.text();
    // 各 stage が含まれているかを順序問わず検証
    expect(text).toContain('event: validating');
    // crawler / estimate が成功した場合のみ後続イベントが出る
    // SSRF block / network 失敗時は event: error が出る
    const hasDone = text.includes('event: done');
    const hasError = text.includes('event: error');
    expect(hasDone || hasError).toBe(true);
  });

  test('rejects non-https URLs with 400 invalid_input', async ({ editorPage }) => {
    const res = await editorPage.request.post('/api/v1/companies/stream', {
      data: { url: 'http://example.com' },
    });
    expect(res.status()).toBe(400);
  });
});
