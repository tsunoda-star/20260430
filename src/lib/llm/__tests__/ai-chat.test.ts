import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { streamAiChat } from '../ai-chat';

const baseInput = {
  item: {
    guidelineName: 'IPA SME',
    guidelineVersion: 'v1.0',
    category: 'governance',
    subCategory: 'access-control',
    controlTitle: 'パスワードポリシー',
    controlDescription: '8文字以上のパスワードポリシーを設定する。',
    referencesExcerpt: 'NIST SP 800-63B',
  },
  question: 'AWS でこのコントロールはどう実装しますか？',
};

/** OpenAI stream response (text/event-stream) を模擬する Response を作る */
function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

async function collect(gen: AsyncGenerator<string, void, unknown>): Promise<string[]> {
  const out: string[] = [];
  for await (const c of gen) out.push(c);
  return out;
}

describe('streamAiChat', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to degraded message when no API key', async () => {
    const r = await streamAiChat(baseInput);
    const chunks = await collect(r.chunks);
    expect(chunks.join('')).toContain('AI 機能が一時停止中です');
    const final = await r.whenDone();
    expect(final.degraded).toBe(true);
    expect(final.answer).toContain('参考: ');
  });

  it('streams delta chunks from OpenAI SSE stream', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"AWS では "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"IAM ポリシー"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"を設定します。"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const fetcher = vi.fn(async () => streamResponse(sseLines)) as unknown as typeof fetch;
    const r = await streamAiChat(baseInput, { apiKey: 'sk-test', fetcher });
    const chunks = await collect(r.chunks);
    expect(chunks).toEqual(['AWS では ', 'IAM ポリシー', 'を設定します。']);
    const final = await r.whenDone();
    expect(final.degraded).toBe(false);
    expect(final.answer).toBe('AWS では IAM ポリシーを設定します。');
  });

  it('sanitizes malicious markdown in the final answer', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"危険: [click](javascript:alert(1))"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const fetcher = vi.fn(async () => streamResponse(sseLines)) as unknown as typeof fetch;
    const r = await streamAiChat(baseInput, { apiKey: 'sk-test', fetcher });
    await collect(r.chunks);
    const final = await r.whenDone();
    expect(final.answer).toContain('[click](#)');
    expect(final.sanitizationNotes.length).toBeGreaterThan(0);
  });

  it('falls back when fetch throws', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    const r = await streamAiChat(baseInput, { apiKey: 'sk-test', fetcher });
    const text = (await collect(r.chunks)).join('');
    expect(text).toContain('AI 機能が一時停止中です');
    const final = await r.whenDone();
    expect(final.degraded).toBe(true);
  });

  it('falls back when OpenAI returns 5xx', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('boom', {
          status: 500,
          headers: { 'content-type': 'text/plain' },
        }),
    ) as unknown as typeof fetch;
    const r = await streamAiChat(baseInput, { apiKey: 'sk-test', fetcher });
    const text = (await collect(r.chunks)).join('');
    expect(text).toContain('AI 機能が一時停止中です');
    const final = await r.whenDone();
    expect(final.degraded).toBe(true);
  });

  it('ignores non-data and heartbeat lines', async () => {
    const sseLines = [
      ': heartbeat\n\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: \n\n',
      'data: [DONE]\n\n',
    ];
    const fetcher = vi.fn(async () => streamResponse(sseLines)) as unknown as typeof fetch;
    const r = await streamAiChat(baseInput, { apiKey: 'sk-test', fetcher });
    const chunks = await collect(r.chunks);
    expect(chunks).toEqual(['ok']);
  });
});
