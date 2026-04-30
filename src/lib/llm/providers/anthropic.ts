import type { LlmEstimationProvider } from '../types';

/**
 * Anthropic Messages API provider (no SDK, fetch-based).
 *
 * 環境変数:
 *   ANTHROPIC_API_KEY     — 必須
 *   ANTHROPIC_MODEL       — 既定 claude-3-5-haiku-20241022 (estimation 用、低コスト)
 *   ANTHROPIC_BASE_URL    — 既定 https://api.anthropic.com/v1
 *
 * spec.md §8.4 (data opt-out): Anthropic は API リクエスト本文を学習に
 * 使わないことを契約上明記している (zero retention contract が選択可)。
 */

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1024;

export interface AnthropicProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxTokens?: number;
  /** 単体テスト用に fetch を差し替え可能 */
  fetcher?: typeof fetch;
}

interface MessagesResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
}

export function createAnthropicProvider(
  config: AnthropicProviderConfig,
): LlmEstimationProvider {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = config.model ?? DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const doFetch = config.fetcher ?? fetch;

  return {
    name: 'anthropic',
    async estimate(prompt, options) {
      // estimation-prompt.ts は SYSTEM\n\n[CONTEXT-PUBLIC]... という形で結合する
      const [system, ...userParts] = prompt.split('\n\n[CONTEXT-PUBLIC]');
      const userPayload =
        userParts.length > 0 ? `[CONTEXT-PUBLIC]${userParts.join('')}` : prompt;
      const controller = new AbortController();
      const externalSignal = options?.signal;
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', () => controller.abort());
      }
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: userPayload }],
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`anthropic_http_${res.status}: ${detail.slice(0, 200)}`);
        }
        const json = (await res.json()) as MessagesResponse;
        const text = json.content?.find((c) => c.type === 'text')?.text;
        if (!text) {
          throw new Error('anthropic_empty_response');
        }
        return { rawResponse: text };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Anthropic Messages stream (stream: true) を Response として取得し、
 * 行単位のリーダを返すヘルパ。ai-chat.ts から利用される。
 */
export async function fetchAnthropicStream(args: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<Response> {
  const baseUrl = (args.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = args.model ?? DEFAULT_MODEL;
  const doFetch = args.fetcher ?? fetch;
  return doFetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': args.apiKey,
      'anthropic-version': '2023-06-01',
      accept: 'text/event-stream',
    },
    signal: args.signal,
    body: JSON.stringify({
      model,
      max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream: true,
      temperature: args.temperature ?? 0.2,
      system: args.system,
      messages: [{ role: 'user', content: args.user }],
    }),
  });
}

/**
 * Anthropic streaming response から `content_block_delta.delta.text_delta`
 * を順次 yield するパーサ.
 *
 * 主なイベント:
 *   - event: message_start
 *   - event: content_block_start
 *   - event: content_block_delta   ← text_delta はここ
 *   - event: content_block_stop
 *   - event: message_delta / message_stop / ping
 */
export async function* parseAnthropicStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload.length === 0) continue;
      try {
        const parsed = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (
          parsed.type === 'content_block_delta' &&
          parsed.delta?.type === 'text_delta' &&
          typeof parsed.delta.text === 'string'
        ) {
          yield parsed.delta.text;
        }
      } catch {
        // 非 JSON / 部分行は無視 (ping 等)
      }
    }
  }
}
