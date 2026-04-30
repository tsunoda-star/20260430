/**
 * spec.md §9.5 + Cycle 7.4: 軽量 Circuit Breaker (LLM 等の外部呼び出し用).
 *
 * - closed:    通常動作. 失敗率 (失敗 / 全試行) を rolling window で計測
 * - open:      閾値超過で open へ. open 中の呼び出しは即時 reject
 * - half-open: open 期間経過後に試行 1 回. 成功で closed, 失敗で再 open
 *
 * 設計方針:
 *   - timeWindow ms 内のサンプルだけを失敗率計算に使う (deque に push/shift)
 *   - 最低試行回数 minCalls 未満では open に遷移しない (誤検知防止)
 *   - Date.now() のみに依存し、テスト時に now() を差し替えられる
 */

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** rolling window 期間 (default 60_000) */
  timeWindowMs?: number;
  /** 失敗率閾値 0..1 (default 0.5) */
  errorRateThreshold?: number;
  /** open 状態を保つ ms (default 10_000) */
  openDurationMs?: number;
  /** open 判定に必要な最小サンプル数 (default 5) */
  minCalls?: number;
  /** テスト用 now 差し替え */
  now?: () => number;
}

interface Sample {
  ts: number;
  ok: boolean;
}

export class CircuitOpenError extends Error {
  readonly state: BreakerState = 'open';
  constructor(message = 'circuit is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private samples: Sample[] = [];
  private openedAt = 0;
  private readonly timeWindowMs: number;
  private readonly errorRateThreshold: number;
  private readonly openDurationMs: number;
  private readonly minCalls: number;
  private readonly now: () => number;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.timeWindowMs = opts.timeWindowMs ?? 60_000;
    this.errorRateThreshold = opts.errorRateThreshold ?? 0.5;
    this.openDurationMs = opts.openDurationMs ?? 10_000;
    this.minCalls = opts.minCalls ?? 5;
    this.now = opts.now ?? Date.now;
  }

  getState(): BreakerState {
    this.tickIfOpen();
    return this.state;
  }

  /** 内部状態を読み取り (テスト用) */
  inspect(): { state: BreakerState; sampleCount: number; errorRate: number } {
    this.tickIfOpen();
    this.evictOldSamples();
    const failures = this.samples.filter((s) => !s.ok).length;
    const total = this.samples.length;
    return {
      state: this.state,
      sampleCount: total,
      errorRate: total === 0 ? 0 : failures / total,
    };
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === 'open') {
      throw new CircuitOpenError();
    }
    try {
      const value = await fn();
      this.recordSuccess();
      return value;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  /** 同期/非同期どちらでも結果を直接登録できる API */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.transitionTo('closed');
      this.samples = []; // 再起動
      return;
    }
    this.push(true);
    // success 単独では open しないが、rolling window 内の累積失敗率を再評価する
    this.maybeOpen();
  }

  recordFailure(): void {
    if (this.state === 'half-open') {
      this.transitionTo('open');
      return;
    }
    this.push(false);
    this.maybeOpen();
  }

  private push(ok: boolean): void {
    this.samples.push({ ts: this.now(), ok });
    this.evictOldSamples();
  }

  private evictOldSamples(): void {
    const cutoff = this.now() - this.timeWindowMs;
    while (this.samples.length > 0 && this.samples[0]!.ts < cutoff) {
      this.samples.shift();
    }
  }

  private maybeOpen(): void {
    this.evictOldSamples();
    if (this.samples.length < this.minCalls) return;
    const failures = this.samples.filter((s) => !s.ok).length;
    if (failures / this.samples.length >= this.errorRateThreshold) {
      this.transitionTo('open');
    }
  }

  private tickIfOpen(): void {
    if (this.state !== 'open') return;
    if (this.now() - this.openedAt >= this.openDurationMs) {
      this.transitionTo('half-open');
    }
  }

  private transitionTo(state: BreakerState): void {
    this.state = state;
    if (state === 'open') {
      this.openedAt = this.now();
    }
  }
}
