'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * fetch + ReadableStream による SSE 受信フック.
 *
 * - EventSource は POST + ヘッダ送信ができないため fetch ベースで実装
 * - 各イベントは { event, id?, data } としてコールバック
 * - cancel(): AbortController.abort() で進行中のリクエストを停止
 * - retry(): 直前の引数で再リクエスト (Last-Event-Id を引き継ぐ)
 */

export type StreamEvent = {
  event: string;
  id?: string;
  data: unknown;
};

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error' | 'cancelled';

export interface UseEventStreamArgs {
  url: string;
  init?: RequestInit;
  /** イベント毎のコールバック */
  onEvent?: (ev: StreamEvent) => void;
  /** 完了時 (エラーなく `done` イベント受領 / ストリーム終了時) */
  onDone?: () => void;
  /** エラー時 (network / parse / event=error) */
  onError?: (message: string) => void;
}

export interface UseEventStreamReturn {
  status: StreamStatus;
  lastEventId: string | null;
  start: (args: UseEventStreamArgs) => void;
  cancel: () => void;
  retry: () => void;
}

function parseSse(buffer: string): { events: StreamEvent[]; rest: string } {
  const events: StreamEvent[] = [];
  const blocks = buffer.split('\n\n');
  // 最後のブロックは未完成の可能性 → rest に残す
  const last = blocks.pop() ?? '';
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = 'message';
    let id: string | undefined;
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('id:')) id = line.slice(3).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      else if (line.startsWith(':')) continue; // コメント/heartbeat
    }
    const dataStr = dataLines.join('\n');
    if (!dataStr.length) continue;
    let data: unknown = dataStr;
    try {
      data = JSON.parse(dataStr);
    } catch {
      // non-JSON データはそのまま渡す
    }
    events.push({ event, id, data });
  }
  return { events, rest: last };
}

export function useEventStream(): UseEventStreamReturn {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const argsRef = useRef<UseEventStreamArgs | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    ctrlRef.current?.abort();
    setStatus('cancelled');
  }, []);

  const start = useCallback((args: UseEventStreamArgs) => {
    argsRef.current = args;
    cancel(); // 二重起動防止
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setStatus('connecting');

    const headers = new Headers(args.init?.headers);
    headers.set('accept', 'text/event-stream');
    if (lastEventId) headers.set('last-event-id', lastEventId);

    void (async () => {
      try {
        const res = await fetch(args.url, {
          ...args.init,
          headers,
          signal: ctrl.signal,
          credentials: args.init?.credentials ?? 'same-origin',
        });
        if (!res.ok || !res.body) {
          setStatus('error');
          args.onError?.(`http_${res.status}`);
          return;
        }
        setStatus('streaming');
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSse(buffer);
          buffer = rest;
          for (const ev of events) {
            if (ev.id) setLastEventId(ev.id);
            args.onEvent?.(ev);
            if (ev.event === 'error') {
              args.onError?.(
                typeof ev.data === 'string'
                  ? ev.data
                  : JSON.stringify(ev.data),
              );
            }
          }
        }
        setStatus('done');
        args.onDone?.();
      } catch (err) {
        if (ctrl.signal.aborted) {
          setStatus('cancelled');
          return;
        }
        setStatus('error');
        args.onError?.(err instanceof Error ? err.message : 'stream_error');
      }
    })();
  }, [cancel, lastEventId]);

  const retry = useCallback(() => {
    if (!argsRef.current) return;
    start(argsRef.current);
  }, [start]);

  return { status, lastEventId, start, cancel, retry };
}
