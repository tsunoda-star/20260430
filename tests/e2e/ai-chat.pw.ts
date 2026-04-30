import { test, expect } from './fixtures';

/**
 * Cycle 5.3 / Cycle 3.1: AI チャット SSE 双方向確認.
 *
 * Pre-conditions:
 *   - Reviewer 以上で auth.setup 済み
 *   - DB に対象 AssessmentItem が存在 (環境変数 TEST_ASSESSMENT_ITEM_ID)
 *   - OpenAI 未設定なら degraded fallback (event: meta { degraded: true })
 */

test.describe('AI chat SSE', () => {
  test.skip(
    !process.env.TEST_ASSESSMENT_ITEM_ID,
    'TEST_ASSESSMENT_ITEM_ID not set — provide a seeded AssessmentItem ID',
  );

  test('streams chunk → meta → done events', async ({ reviewerPage }) => {
    const id = process.env.TEST_ASSESSMENT_ITEM_ID!;
    const res = await reviewerPage.request.post(
      `/api/v1/assessment-items/${id}/ai-chat`,
      {
        data: { question: 'AWS でこのコントロールはどう実装しますか？' },
      },
    );
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('event: chunk');
    expect(text).toContain('event: meta');
    expect(text).toContain('event: done');
  });

  test('rejects too-long question (zod cap 1000)', async ({ reviewerPage }) => {
    const id = process.env.TEST_ASSESSMENT_ITEM_ID!;
    const big = 'あ'.repeat(2_000);
    const res = await reviewerPage.request.post(
      `/api/v1/assessment-items/${id}/ai-chat`,
      { data: { question: big } },
    );
    expect(res.status()).toBe(400);
  });

  test('viewer cannot use AI chat (403)', async ({ viewerPage }) => {
    const id = process.env.TEST_ASSESSMENT_ITEM_ID ?? '1';
    const res = await viewerPage.request.post(
      `/api/v1/assessment-items/${id}/ai-chat`,
      { data: { question: '?' } },
    );
    expect(res.status()).toBe(403);
  });
});
