/**
 * spec.md §3.5 + Cycle 7.4: Token Bucket レート制限 (in-memory).
 *
 * - key (例: tenantId + route) ごとに容量 cap, 速度 refillPerSec の bucket を保持
 * - 取得 (consume) で 1 トークン消費. 残量不足なら拒否 (429)
 * - tick (Date.now) ベースで遅延 refill
 * - 単一インスタンス前提. multi-instance 化時は Redis に移行する想定
 *
 * 既定値 (spec.md §1.5 Rate Limit Token Bucket): 100/min
 *   capacity=100, refillPerSec=100/60 ≈ 1.667
 * LLM 用厳しめ: 10/min
 */

export interface RateLimiterOptions {
  /** バケット容量 (default 100) */
  capacity?: number;
  /** トークン補充速度 (per second). default capacity / 60 (= 1分で満タン) */
  refillPerSec?: number;
  /** テスト用 now */
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** 次に 1 トークン回復するまでの ms (allowed=true の場合は 0) */
  retryAfterMs: number;
}

interface Bucket {
  tokens: number;
  updatedAtMs: number;
}

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private readonly now: () => number;

  constructor(opts: RateLimiterOptions = {}) {
    this.capacity = opts.capacity ?? 100;
    this.refillPerSec = opts.refillPerSec ?? this.capacity / 60;
    this.now = opts.now ?? Date.now;
  }

  /** 1 トークン消費を試行 */
  consume(key: string, cost = 1): RateLimitResult {
    const nowMs = this.now();
    const bucket = this.refill(key, nowMs);
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0 };
    }
    const need = cost - bucket.tokens;
    const retryAfterMs = Math.ceil((need / this.refillPerSec) * 1000);
    return { allowed: false, remaining: bucket.tokens, retryAfterMs };
  }

  /** 状態確認のみ (consume せず) */
  peek(key: string): RateLimitResult {
    const nowMs = this.now();
    const bucket = this.refill(key, nowMs);
    return {
      allowed: bucket.tokens >= 1,
      remaining: bucket.tokens,
      retryAfterMs: bucket.tokens >= 1 ? 0 : Math.ceil((1 / this.refillPerSec) * 1000),
    };
  }

  /** テスト用クリア */
  reset(): void {
    this.buckets.clear();
  }

  private refill(key: string, nowMs: number): Bucket {
    const existing = this.buckets.get(key);
    if (!existing) {
      const created: Bucket = { tokens: this.capacity, updatedAtMs: nowMs };
      this.buckets.set(key, created);
      return created;
    }
    const elapsedSec = (nowMs - existing.updatedAtMs) / 1000;
    if (elapsedSec > 0) {
      existing.tokens = Math.min(
        this.capacity,
        existing.tokens + elapsedSec * this.refillPerSec,
      );
      existing.updatedAtMs = nowMs;
    }
    return existing;
  }
}

/** spec.md §1.5 既定: 一般 API 100/min */
export const generalRateLimiter = new TokenBucketLimiter({ capacity: 100 });

/** LLM 経路用: 10/min */
export const llmRateLimiter = new TokenBucketLimiter({
  capacity: 10,
  refillPerSec: 10 / 60,
});
