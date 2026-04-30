import { describe, it, expect } from 'vitest';
import { TokenBucketLimiter } from '../rate-limit';

function fakeNow() {
  let t = 1_000_000;
  return {
    advance: (ms: number) => {
      t += ms;
    },
    now: () => t,
  };
}

describe('TokenBucketLimiter', () => {
  it('starts with full capacity', () => {
    const l = new TokenBucketLimiter({ capacity: 100 });
    expect(l.peek('k')).toMatchObject({ allowed: true, remaining: 100 });
  });

  it('decrements tokens on consume', () => {
    const l = new TokenBucketLimiter({ capacity: 5 });
    expect(l.consume('k').allowed).toBe(true);
    expect(l.consume('k').allowed).toBe(true);
    expect(l.peek('k').remaining).toBe(3);
  });

  it('blocks when tokens are exhausted and reports retryAfterMs', () => {
    const clock = fakeNow();
    const l = new TokenBucketLimiter({
      capacity: 3,
      refillPerSec: 1,
      now: clock.now,
    });
    expect(l.consume('k').allowed).toBe(true);
    expect(l.consume('k').allowed).toBe(true);
    expect(l.consume('k').allowed).toBe(true);
    const blocked = l.consume('k');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBeLessThan(1);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills tokens over time at refillPerSec', () => {
    const clock = fakeNow();
    const l = new TokenBucketLimiter({
      capacity: 5,
      refillPerSec: 1,
      now: clock.now,
    });
    for (let i = 0; i < 5; i++) l.consume('k');
    expect(l.consume('k').allowed).toBe(false);
    clock.advance(2_500);
    const after = l.consume('k');
    expect(after.allowed).toBe(true);
    // 残り: refill=2.5 → consume 1 = 1.5
    expect(after.remaining).toBeGreaterThanOrEqual(1);
    expect(after.remaining).toBeLessThanOrEqual(2);
  });

  it('caps refill at capacity', () => {
    const clock = fakeNow();
    const l = new TokenBucketLimiter({
      capacity: 5,
      refillPerSec: 10,
      now: clock.now,
    });
    l.consume('k');
    clock.advance(60_000); // 大量経過
    expect(l.peek('k').remaining).toBe(5);
  });

  it('isolates buckets per key', () => {
    const l = new TokenBucketLimiter({ capacity: 1 });
    expect(l.consume('a').allowed).toBe(true);
    expect(l.consume('a').allowed).toBe(false);
    expect(l.consume('b').allowed).toBe(true);
  });

  it('default capacity = 100, refill = capacity/60 per sec', () => {
    const clock = fakeNow();
    const l = new TokenBucketLimiter({ now: clock.now });
    for (let i = 0; i < 100; i++) l.consume('k');
    expect(l.consume('k').allowed).toBe(false);
    clock.advance(60_000);
    expect(l.peek('k').remaining).toBe(100);
  });

  it('reset clears all buckets', () => {
    const l = new TokenBucketLimiter({ capacity: 1 });
    l.consume('a');
    l.reset();
    expect(l.peek('a').remaining).toBe(1);
  });
});
