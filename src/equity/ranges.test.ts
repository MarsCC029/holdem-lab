import { describe, expect, it } from 'vitest';
import { rangeComboCount, rangeCombos, simulateRangeEquity } from './ranges';
import type { RangePreset, RangeEquityOptions } from './ranges';

const options: RangeEquityOptions = { hero: ['2c', '3d'], board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
  opponents: [{ seatIndex: 1, preset: 'standard' }], iterations: 1000, seed: 42 };
describe('illustrative range sampling', () => {
  it('preserves concrete combination weights and blockers', () => {
    const presets: RangePreset[] = ['tight', 'standard', 'loose'];
    expect(presets.map((p) => rangeComboCount(p))).toEqual([98, 294, 666]);
    expect(presets.map((p) => rangeComboCount(p, ['As', 'Ah']))).toEqual([73, 241, 565]);
    expect(presets.map((p) => rangeComboCount(p, ['As', 'Ah', 'Kd', 'Qc', 'Js']))).toEqual([53, 195, 481]);
    for (const combo of rangeCombos('loose', ['As', 'Ah'])) expect(combo).not.toContain('As');
  });
  it('splits a board royal correctly heads-up and multiway', () => {
    const hu = simulateRangeEquity(options);
    expect(hu.status).toBe('ok'); expect(hu.equity).toBe(0.5); expect(hu.win).toBe(0); expect(hu.tie).toBe(1);
    const mw = simulateRangeEquity({ ...options, opponents: [...options.opponents, { seatIndex: 2, preset: 'tight' }] });
    expect(mw.equity).toBeCloseTo(1 / 3, 12); expect(mw.standardError).toBe(0);
  });
  it('reproduces accepted sample outcomes and rejects duplicate/invalid cards', () => {
    const o: RangeEquityOptions = { ...options, hero: ['Ah', 'Ad'], board: [],
      opponents: [{ seatIndex: 1, preset: 'tight' }, { seatIndex: 2, preset: 'tight' }] };
    expect(simulateRangeEquity(o)).toEqual(simulateRangeEquity(o));
    expect(simulateRangeEquity({ ...o, hero: ['Ah', 'Ah'] }).status).toBe('invalid-input');
    expect(simulateRangeEquity({ ...o, board: ['XX', '3c', '4d'] }).status).toBe('invalid-input');
  });
  it('rejects the entire colliding tuple and terminates without a widening fallback', () => {
    const r = simulateRangeEquity({ ...options, opponents: Array.from({ length: 5 }, (_, i) => ({ seatIndex: i + 1, preset: 'tight' as const })), maxProposals: 10 });
    expect(r.status).toBe('insufficient-samples'); expect(r.attempts).toBe(10); expect(r.samples).toBeLessThanOrEqual(10);
  });
});
