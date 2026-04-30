/**
 * spec.md §4.1 / §9.6 / Cycle 3.4: SSE (text/event-stream) 共通ヘルパー.
 *
 * - 各イベントは `event: <name>\nid: <id>\ndata: <json>\n\n` 形式
 * - id は Last-Event-Id ヘッダで再開時の起点判定に使う (本実装は in-memory)
 * - heartbeat (`: keep-alive\n\n`) を 15s ごとに送るためのタイマーは
 *   呼び出し側で setInterval (encoder 経由)
 *
 * 設計方針:
 *   - data は JSON.stringify, 制御文字は CRLF を改行ごとに data: で連続送信する
 *   - id は文字列 (例: 'crawl-start')、event 名と組み合わせて idempotent
 */

const ENCODER = new TextEncoder();

export interface SseEvent {
  event: string;
  id?: string;
  data: unknown;
}

/** SSE フォーマット文字列を生成 */
export function formatSseEvent(ev: SseEvent): string {
  const lines: string[] = [];
  lines.push(`event: ${ev.event}`);
  if (ev.id !== undefined) lines.push(`id: ${ev.id}`);
  const json = JSON.stringify(ev.data);
  for (const dataLine of json.split('\n')) {
    lines.push(`data: ${dataLine}`);
  }
  lines.push('', ''); // 空行でレコード終端
  return lines.join('\n');
}

/** バイト列 (Uint8Array) として書き出し */
export function encodeSseEvent(ev: SseEvent): Uint8Array {
  return ENCODER.encode(formatSseEvent(ev));
}

/** heartbeat (コメント行) — 接続維持用 */
export const HEARTBEAT = ENCODER.encode(': keep-alive\n\n');

/**
 * Last-Event-Id ヘッダを既知の id 順序リストと照合し、再開すべきオフセットを返す。
 * 該当なし → 0 (先頭から)。
 */
export function resumeOffset(lastEventId: string | null, knownIds: ReadonlyArray<string>): number {
  if (!lastEventId) return 0;
  const idx = knownIds.indexOf(lastEventId);
  return idx < 0 ? 0 : idx + 1;
}

/**
 * 標準的な SSE Response ヘッダ。
 */
export const SSE_HEADERS: Readonly<Record<string, string>> = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  // proxy buffering 無効化 (Nginx + 一部 ALB)
  'x-accel-buffering': 'no',
};
