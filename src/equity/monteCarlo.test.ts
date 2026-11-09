import { describe, expect, it } from 'vitest';
import { monteCarloEquity } from './monteCarlo';

describe('monteCarloEquity vs known values', () => {
  it('AA heads-up vs a random hand ≈ 85%', () => {
    const r = monteCarloEquity({ hero: ['As', 'Ah'], board: [], opponents: 1, iterations: 20_000, seed: 1 });
    expect(r.equity).toBeGreaterThan(0.835);
    expect(r.equity).toBeLessThan(0.87);
  });

  it('72o heads-up vs a random hand ≈ 35%', () => {
    const r = monteCarloEquity({ hero: ['7h', '2c'], board: [], opponents: 1, iterations: 20_000, seed: 2 });
    expect(r.equity).toBeGreaterThan(0.32);
    expect(r.equity).toBeLessThan(0.38);
  });

  it('AA vs 4 random hands ≈ 56%', () => {
    const r = monteCarloEquity({ hero: ['As', 'Ah'], board: [], opponents: 4, iterations: 20_000, seed: 3 });
    expect(r.equity).toBeGreaterThan(0.52);
    expect(r.equity).toBeLessThan(0.60);
  });

  it('AKs vs QQ (known hand) ≈ 46%', () => {
    const r = monteCarloEquity({
      hero: ['As', 'Ks'],
      board: [],
      opponents: 0,
      knownOpponents: [['Qh', 'Qd']],
      iterations: 20_000,
      seed: 4,
    });
    expect(r.equity).toBeGreaterThan(0.43);
    expect(r.equity).toBeLessThan(0.49);
  });

  it('flush draw on the flop vs a set ≈ 26%', () => {
    // Ah9h on Kh 7h 2c vs KcKd (set of kings): draw needs to hit without board pairing
    const r = monteCarloEquity({
      hero: ['Ah', '9h'],
      board: ['Kh', '7h', '2c'],
      opponents: 0,
      knownOpponents: [['Kc', 'Kd']],
      iterations: 20_000,
      seed: 5,
    });
    expect(r.equity).toBeGreaterThan(0.2);
    expect(r.equity).toBeLessThan(0.31);
  });

  it('is deterministic for a fixed seed', () => {
    const a = monteCarloEquity({ hero: ['Js', 'Th'], board: ['9c', '8d', '2h'], opponents: 2, iterations: 5000, seed: 42 });
    const b = monteCarloEquity({ hero: ['Js', 'Th'], board: ['9c', '8d', '2h'], opponents: 2, iterations: 5000, seed: 42 });
    expect(a).toEqual(b);
  });

  it('is fast enough for the live coach (5k iterations well under 100ms)', () => {
    const start = performance.now();
    monteCarloEquity({ hero: ['Qs', 'Jd'], board: ['Tc', '4h', '2s'], opponents: 3, iterations: 5000, seed: 6 });
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(100);
  });
});
