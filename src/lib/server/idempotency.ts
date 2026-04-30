/**
 * Idempotency-Key 24h ストア (in-memory).
 * spec.md §3.3 / §9.2: POST /api/v1/assessments で同一キー再投入時は前回結果を返す。
 *
 * - 単一インスタンス前提 (将来 Redis / DB 化を想定)
 * - 24h で自動失効 (lazy GC: get/set 毎にクリーンアップ)
 * - サイズ上限 10000 — 越えた場合は古いものから FIFO で破棄 (DoS ガード)
 *
 * 実装は同期 API のみ (Route Handler 内で待ち合わせ不要)。
 */

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 10_000;

interface Entry {
  storedAt: number;
  /** 任意の serialize 可能な前回レスポンス */
  payload: unknown;
}

interface Store {
  map: Map<string, Entry>;
}

const store: Store = { map: new Map() };

function gc(now: number): void {
  // 期限切れ削除
  for (const [k, v] of store.map) {
    if (now - v.storedAt > TTL_MS) store.map.delete(k);
  }
  // FIFO 上限
  while (store.map.size > MAX_ENTRIES) {
    const first = store.map.keys().next().value;
    if (first === undefined) break;
    store.map.delete(first);
  }
}

export function getIdempotent<T = unknown>(tenantId: string | bigint, key: string): T | undefined {
  const now = Date.now();
  gc(now);
  const id = `${tenantId}:${key}`;
  const e = store.map.get(id);
  if (!e) return undefined;
  if (now - e.storedAt > TTL_MS) {
    store.map.delete(id);
    return undefined;
  }
  return e.payload as T;
}

export function setIdempotent<T>(tenantId: string | bigint, key: string, payload: T): void {
  const now = Date.now();
  gc(now);
  const id = `${tenantId}:${key}`;
  // 同一キー再投入: 既存を尊重 (caller の責任で判定する)
  store.map.set(id, { storedAt: now, payload });
}

/** Idempotency-Key の形式チェック (空白なし、長さ 1..256) */
export function isValidIdempotencyKey(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.length < 1 || value.length > 256) return false;
  return /^[A-Za-z0-9_\-:.]+$/.test(value);
}

/** テスト用 — 全クリア */
export function __resetIdempotencyStore(): void {
  store.map.clear();
}
