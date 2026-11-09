import { describe, expect, it } from 'vitest';
import { buildPots } from './potManager';

function player(seatIndex: number, totalCommitted: number, folded = false) {
  return { seatIndex, totalCommitted, folded };
}

describe('buildPots', () => {
  it('single pot when everyone committed the same', () => {
    const { pots, uncalled } = buildPots([player(0, 100), player(1, 100), player(2, 100)]);
    expect(uncalled).toBeNull();
    expect(pots).toEqual([{ amount: 300, eligible: [0, 1, 2] }]);
  });

  it('returns an uncalled bet when nobody matched', () => {
    const { pots, uncalled } = buildPots([player(0, 300), player(1, 100, true)]);
    expect(uncalled).toEqual({ seatIndex: 0, amount: 200 });
    expect(pots).toEqual([{ amount: 200, eligible: [0] }]);
  });

  it('classic 3-way all-in: stacks 100/250 with a 250 call', () => {
    // A all-in 100, B all-in 250, C calls 250
    const { pots, uncalled } = buildPots([player(0, 100), player(1, 250), player(2, 250)]);
    expect(uncalled).toBeNull();
    expect(pots).toEqual([
      { amount: 300, eligible: [0, 1, 2] }, // main
      { amount: 300, eligible: [1, 2] }, // side
    ]);
  });

  it('overbet shove gets the excess back before pots are built', () => {
    // A all-in 100, B all-in 250, C shoves 600 — nobody can call C above 250
    const { pots, uncalled } = buildPots([player(0, 100), player(1, 250), player(2, 600)]);
    expect(uncalled).toEqual({ seatIndex: 2, amount: 350 });
    expect(pots).toEqual([
      { amount: 300, eligible: [0, 1, 2] },
      { amount: 300, eligible: [1, 2] },
    ]);
  });

  it("folded player's chips stay in the pot but they are not eligible", () => {
    const { pots, uncalled } = buildPots([player(0, 100, true), player(1, 400), player(2, 400)]);
    expect(uncalled).toBeNull();
    expect(pots).toEqual([{ amount: 900, eligible: [1, 2] }]);
  });

  it('multiple all-in levels with folds mixed in', () => {
    // A all-in 50, B folded after 200, C all-in 500, D calls 500
    const { pots, uncalled } = buildPots([
      player(0, 50),
      player(1, 200, true),
      player(2, 500),
      player(3, 500),
    ]);
    expect(uncalled).toBeNull();
    expect(pots).toEqual([
      { amount: 200, eligible: [0, 2, 3] }, // 50 x 4
      // 50→200 layer (150 from B, C, D = 450) merges with the 200→500 layer
      // (300 from C and D = 600) since both have the same eligible set
      { amount: 1050, eligible: [2, 3] },
    ]);
  });

  it('blind-only fold-around: BB uncalled above SB level', () => {
    // SB folded 5 in, BB has 10 in, everyone else folded with 0
    const { pots, uncalled } = buildPots([player(0, 0, true), player(1, 5, true), player(2, 10)]);
    expect(uncalled).toEqual({ seatIndex: 2, amount: 5 });
    expect(pots).toEqual([{ amount: 10, eligible: [2] }]);
  });
});
