import { describe, it, expect } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../circuit-breaker';

function fakeNow() {
  let t = 1_000_000;
  return {
    advance: (ms: number) => {
      t += ms;
    },
    now: () => t,
  };
}

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('closed');
  });

  it('opens after errorRate threshold (default 0.5) with minCalls 5', () => {
    const cb = new CircuitBreaker({ minCalls: 5, errorRateThreshold: 0.5 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordSuccess();
    expect(cb.getState()).toBe('open');
  });

  it('does not open below minCalls', () => {
    const cb = new CircuitBreaker({ minCalls: 5 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('closed');
  });

  it('rejects with CircuitOpenError while open', async () => {
    const cb = new CircuitBreaker({ minCalls: 1, errorRateThreshold: 1 });
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    await expect(
      cb.exec(async () => 'should not run'),
    ).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('transitions to half-open after openDurationMs and closes on success', async () => {
    const clock = fakeNow();
    const cb = new CircuitBreaker({
      minCalls: 1,
      errorRateThreshold: 1,
      openDurationMs: 5_000,
      now: clock.now,
    });
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    clock.advance(6_000);
    expect(cb.getState()).toBe('half-open');
    await cb.exec(async () => 'ok');
    expect(cb.getState()).toBe('closed');
  });

  it('reopens immediately on half-open failure', async () => {
    const clock = fakeNow();
    const cb = new CircuitBreaker({
      minCalls: 1,
      errorRateThreshold: 1,
      openDurationMs: 5_000,
      now: clock.now,
    });
    cb.recordFailure();
    clock.advance(6_000);
    expect(cb.getState()).toBe('half-open');
    await expect(
      cb.exec(async () => {
        throw new Error('still broken');
      }),
    ).rejects.toThrow();
    expect(cb.getState()).toBe('open');
  });

  it('evicts samples outside the time window', () => {
    const clock = fakeNow();
    const cb = new CircuitBreaker({
      minCalls: 5,
      errorRateThreshold: 0.5,
      timeWindowMs: 1_000,
      now: clock.now,
    });
    for (let i = 0; i < 5; i++) cb.recordFailure();
    expect(cb.getState()).toBe('open');
    clock.advance(2_000);
    // open 状態から half-open に遷移するが、samples は古いので新規動作可能
    const insp = cb.inspect();
    expect(insp.sampleCount).toBe(0);
  });

  it('inspect reports current sampleCount and errorRate', () => {
    const cb = new CircuitBreaker({ minCalls: 100 }); // open しないように
    cb.recordSuccess();
    cb.recordSuccess();
    cb.recordFailure();
    const r = cb.inspect();
    expect(r.sampleCount).toBe(3);
    expect(r.errorRate).toBeCloseTo(1 / 3, 4);
  });
});
