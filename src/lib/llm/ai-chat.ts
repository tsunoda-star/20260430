import { sanitizeAiChatMarkdown } from './markdown-sanitize';
import { buildAiChatPrompt, AI_CHAT_PROMPT_VERSION, type AiChatInput } from './ai-chat-prompt';
import { fetchAnthropicStream, parseAnthropicStream } from './providers/anthropic';

/**
 * spec.md §4.3 ai_chat ストリーミング実装.
 *
 * - OpenAI Chat Completions の `stream: true` を fetch ベースで消費
 * - delta.content を順次 yield (AsyncGenerator<string>)
 * - 失敗 / API key 未設定 → 1 度だけ degraded メッセージを yield して終了
 *
 * 完了後の永続化と Markdown サニタイズ:
 *   - サニタイズは「累積した最終回答」に対して行う (chunk 毎ではない)
 *   - 永続化は呼び出し側 (route handler) の責務 (ai_chats / AuditLog)
 */

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 60_000;

const DEGRADED_MESSAGE =
  'AI 機能が一時停止中です。手動入力で続行できます。\n参考: https://www.ipa.go.jp/security/sme/index.html';

export interface AiChatStreamOptions {
  signal?: AbortSignal;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** テスト用 fetch 差し替え */
  fetcher?: typeof fetch;
}

export interface AiChatStreamResult {
  /** SSE chunk (delta テキスト) */
  chunks: AsyncGenerator<string, void, unknown>;
  /** ストリーム完了後にアクセス可能になる累積回答 (sanitized) */
  whenDone: () => Promise<{
    answer: string;
    promptVersion: typeof AI_CHAT_PROMPT_VERSION;
    degraded: boolean;
    sanitizationNotes: string[];
  }>;
}

interface OpenAiStreamLine {
  choices?: Array<{ delta?: { content?: string | null } }>;
}

type Provider = 'openai' | 'anthropic';

function selectProvider(opts: AiChatStreamOptions): {
  provider: Provider | null;
  apiKey?: string;
  model?: string;
} {
  const choice = (
    process.env.LLM_PRIMARY_PROVIDER ??
    process.env.LLM_PROVIDER ??
    'openai'
  ).toLowerCase();
  if (choice === 'anthropic') {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { provider: null };
    return {
      provider: 'anthropic',
      apiKey,
      model: opts.model ?? process.env.ANTHROPIC_MODEL,
    };
  }
  // default: openai
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider: null };
  return {
    provider: 'openai',
    apiKey,
    model: opts.model ?? process.env.OPENAI_MODEL,
  };
}

function selectApiKey(opts: AiChatStreamOptions): string | undefined {
  return opts.apiKey ?? process.env.OPENAI_API_KEY ?? undefined;
}

/**
 * OpenAI streaming response (text/event-stream) を行単位で読み、
 * `data: {...}` の delta.content を yield する。
 */
async function* parseOpenAiStream(
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
      if (payload === '[DONE]' || payload.length === 0) continue;
      try {
        const parsed = JSON.parse(payload) as OpenAiStreamLine;
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // 非 JSON ラインは黙ってスキップ (heartbeat 等)
      }
    }
  }
}

/**
 * AI チャットを streaming 取得する。
 * チャンク列を返し、完了後に sanitized full answer をまとめて返却。
 */
export async function streamAiChat(
  input: AiChatInput,
  opts: AiChatStreamOptions = {},
): Promise<AiChatStreamResult> {
  const sel = selectProvider(opts);
  const built = buildAiChatPrompt(input);

  // degraded fallback: API key 不在 → 単発メッセージを yield
  if (sel.provider === null) {
    let full = '';
    return makeFallbackResult(DEGRADED_MESSAGE, (s) => {
      full = s;
    }, () => full);
  }

  const fetcher = opts.fetcher ?? fetch;
  const controller = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort());
  }
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    if (sel.provider === 'anthropic') {
      res = await fetchAnthropicStream({
        apiKey: sel.apiKey!,
        model: sel.model,
        baseUrl: opts.baseUrl,
        system: built.system,
        user: built.user,
        signal: controller.signal,
        fetcher,
      });
    } else {
      const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
      const model = sel.model ?? DEFAULT_MODEL;
      res = await fetcher(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sel.apiKey!}`,
          'OpenAI-Beta': 'log-retention=0',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: built.system },
            { role: 'user', content: built.user },
          ],
          stream: true,
          temperature: 0.2,
        }),
      });
    }
  } catch {
    clearTimeout(timer);
    let full = '';
    return makeFallbackResult(DEGRADED_MESSAGE, (s) => {
      full = s;
    }, () => full);
  }
  if (!res.ok || !res.body) {
    clearTimeout(timer);
    let full = '';
    return makeFallbackResult(DEGRADED_MESSAGE, (s) => {
      full = s;
    }, () => full);
  }

  const reader = res.body.getReader();
  let accumulated = '';
  let degraded = false;
  let sanitizationNotes: string[] = [];
  const streamParser =
    sel.provider === 'anthropic' ? parseAnthropicStream : parseOpenAiStream;

  async function* gen(): AsyncGenerator<string, void, unknown> {
    try {
      for await (const chunk of streamParser(reader)) {
        accumulated += chunk;
        yield chunk;
      }
    } catch {
      degraded = true;
      const fb = DEGRADED_MESSAGE;
      accumulated = fb;
      yield fb;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    chunks: gen(),
    whenDone: async () => {
      const sanitized = sanitizeAiChatMarkdown(accumulated);
      sanitizationNotes = sanitized.notes;
      return {
        answer: sanitized.text,
        promptVersion: built.promptVersion,
        degraded,
        sanitizationNotes,
      };
    },
  };
}

function makeFallbackResult(
  message: string,
  setFull: (s: string) => void,
  getFull: () => string,
): AiChatStreamResult {
  async function* fb(): AsyncGenerator<string, void, unknown> {
    setFull(message);
    yield message;
  }
  return {
    chunks: fb(),
    whenDone: async () => {
      const sanitized = sanitizeAiChatMarkdown(getFull());
      return {
        answer: sanitized.text,
        promptVersion: AI_CHAT_PROMPT_VERSION,
        degraded: true,
        sanitizationNotes: sanitized.notes,
      };
    },
  };
}
