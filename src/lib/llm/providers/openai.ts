import type { LlmEstimationProvider } from '../types';

/**
 * OpenAI Chat Completions provider (no SDK, fetch-based).
 * spec.md §8.4: data opt-out 契約 (Enterprise tier) を前提にログ保持最小化ヘッダを付与。
 *
 * 環境変数:
 *   OPENAI_API_KEY      — 必須
 *   OPENAI_MODEL        — 既定 gpt-4o-mini (estimation 用、安価モデル)
 *   OPENAI_BASE_URL     — 既定 https://api.openai.com/v1
 */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface OpenAiProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** 単体テスト用に fetch を差し替え可能 */
  fetcher?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export function createOpenAiProvider(config: OpenAiProviderConfig): LlmEstimationProvider {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = config.model ?? DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = config.fetcher ?? fetch;

  return {
    name: 'openai',
    async estimate(prompt, options) {
      const [system, ...userParts] = prompt.split('\n\n[CONTEXT-PUBLIC]');
      const userPayload = userParts.length > 0 ? `[CONTEXT-PUBLIC]${userParts.join('')}` : prompt;
      const controller = new AbortController();
      const externalSignal = options?.signal;
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', () => controller.abort());
      }
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await doFetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${config.apiKey}`,
            // §8.4 ログ保持最小化 (契約上で zero-retention)
            'OpenAI-Beta': 'log-retention=0',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userPayload },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`openai_http_${res.status}: ${detail.slice(0, 200)}`);
        }
        const json = (await res.json()) as ChatCompletionResponse;
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('openai_empty_response');
        }
        return { rawResponse: content };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
