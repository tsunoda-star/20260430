import { describe, it, expect, vi } from 'vitest';
import { createOpenAiProvider } from '../openai';

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createOpenAiProvider', () => {
  it('returns provider name "openai"', () => {
    const p = createOpenAiProvider({ apiKey: 'sk-test' });
    expect(p.name).toBe('openai');
  });

  it('calls /chat/completions with bearer + log-retention header', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: '{"ok":true}' } }] }),
    ) as unknown as typeof fetch;
    const p = createOpenAiProvider({ apiKey: 'sk-test', fetcher });
    const r = await p.estimate('SYSTEM\n\n[CONTEXT-PUBLIC]\nfoo');
    expect(r.rawResponse).toBe('{"ok":true}');
    const calls = (fetcher as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const init = calls[0]?.[1] as RequestInit;
    expect(calls[0]?.[0]).toContain('/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-test');
    expect(headers['OpenAI-Beta']).toBe('log-retention=0');
    const body = JSON.parse(init.body as string) as {
      model: string;
      response_format: { type: string };
      temperature: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.response_format.type).toBe('json_object');
    expect(body.temperature).toBe(0);
    expect(body.model).toBe('gpt-4o-mini');
    // SYSTEM / USER 分離
    expect(body.messages[0]?.role).toBe('system');
    expect(body.messages[1]?.role).toBe('user');
  });

  it('respects custom model + baseUrl options', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: '{}' } }] }),
    ) as unknown as typeof fetch;
    const p = createOpenAiProvider({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      baseUrl: 'https://custom.example/v1/',
      fetcher,
    });
    await p.estimate('S\n\nU');
    const calls = (fetcher as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls[0]?.[0]).toBe('https://custom.example/v1/chat/completions');
    const body = JSON.parse((calls[0]?.[1] as RequestInit).body as string) as {
      model: string;
    };
    expect(body.model).toBe('gpt-4o');
  });

  it('throws on non-2xx with status code in the message', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('rate limit', { status: 429, headers: { 'content-type': 'text/plain' } }),
    ) as unknown as typeof fetch;
    const p = createOpenAiProvider({ apiKey: 'sk-test', fetcher });
    await expect(p.estimate('S\n\nU')).rejects.toThrow(/openai_http_429/);
  });

  it('throws when response has no content', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ choices: [] })) as unknown as typeof fetch;
    const p = createOpenAiProvider({ apiKey: 'sk-test', fetcher });
    await expect(p.estimate('S\n\nU')).rejects.toThrow(/openai_empty_response/);
  });

  it('aborts when external signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const fetcher = vi.fn(async (_url, init: RequestInit | undefined) => {
      // 内部 controller が即時 abort されることを確認
      if (init?.signal?.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }
      return jsonResponse({ choices: [{ message: { content: '' } }] });
    }) as unknown as typeof fetch;
    const p = createOpenAiProvider({ apiKey: 'sk-test', fetcher });
    await expect(p.estimate('S\n\nU', { signal: ctrl.signal })).rejects.toBeInstanceOf(
      DOMException,
    );
  });
});
