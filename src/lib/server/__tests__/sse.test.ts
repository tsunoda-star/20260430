import { describe, it, expect } from 'vitest';
import {
  formatSseEvent,
  encodeSseEvent,
  resumeOffset,
  HEARTBEAT,
  SSE_HEADERS,
} from '../sse';

describe('formatSseEvent', () => {
  it('builds standard SSE record with event/id/data', () => {
    const out = formatSseEvent({ event: 'crawling', id: 'crawling', data: { hops: 1 } });
    expect(out).toBe('event: crawling\nid: crawling\ndata: {"hops":1}\n\n');
  });

  it('omits id when not provided', () => {
    const out = formatSseEvent({ event: 'msg', data: 'ok' });
    expect(out.split('\n')).toEqual(['event: msg', 'data: "ok"', '', '']);
  });

  it('emits multi-line data: for embedded newlines (encoded JSON)', () => {
    const out = formatSseEvent({ event: 'x', data: 'line1\nline2' });
    // JSON.stringify("line1\nline2") = "\"line1\\nline2\""
    // 文字列内に '\n' は来ないので 1行
    expect(out).toContain('data: "line1\\nline2"');
  });

  it('terminates the record with a blank line', () => {
    const out = formatSseEvent({ event: 'done', id: 'done', data: {} });
    expect(out.endsWith('\n\n')).toBe(true);
  });
});

describe('encodeSseEvent', () => {
  it('returns Uint8Array of formatSseEvent', () => {
    const u = encodeSseEvent({ event: 'a', data: 1 });
    expect(u).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(u)).toBe(formatSseEvent({ event: 'a', data: 1 }));
  });
});

describe('resumeOffset', () => {
  const ids = ['validating', 'crawling', 'estimating', 'persisting', 'done'];

  it('returns 0 when lastEventId is null', () => {
    expect(resumeOffset(null, ids)).toBe(0);
  });

  it('returns 0 when lastEventId is unknown', () => {
    expect(resumeOffset('garbage', ids)).toBe(0);
  });

  it('skips already-seen events', () => {
    expect(resumeOffset('validating', ids)).toBe(1);
    expect(resumeOffset('crawling', ids)).toBe(2);
    expect(resumeOffset('done', ids)).toBe(5);
  });
});

describe('HEARTBEAT and SSE_HEADERS', () => {
  it('HEARTBEAT is a comment line', () => {
    expect(new TextDecoder().decode(HEARTBEAT)).toBe(': keep-alive\n\n');
  });

  it('SSE_HEADERS sets text/event-stream and disables proxy buffering', () => {
    expect(SSE_HEADERS['content-type']).toContain('text/event-stream');
    expect(SSE_HEADERS['cache-control']).toContain('no-cache');
    expect(SSE_HEADERS['x-accel-buffering']).toBe('no');
  });
});
