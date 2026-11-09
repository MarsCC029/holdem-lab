import { describe, expect, it } from 'vitest';
import type { Card, TableConfig } from '../engine/types';
import { applyAction, startHandWithDeck } from '../engine/gameStateMachine';
import { freshDeck } from '../engine/deck';
import { ladderRow, summarizeHand } from './handSummary';

function config(stacks: number[], buttonIndex = 0): TableConfig {
  return {
    smallBlind: 5,
    bigBlind: 10,
    buttonIndex,
    seats: stacks.map((stack, i) => ({ id: `p${i}`, name: `P${i}`, stack, isHero: i === 0 })),
  };
}

function riggedDeck(buttonIndex: number, holes: [Card, Card][], board: Card[]): Card[] {
  const n = holes.length;
  const deal: Card[] = [];
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= n; i++) deal.push(holes[(buttonIndex + i) % n][round]);
  }
  const used = new Set([...deal, ...board]);
  return [...deal, ...board, ...freshDeck().filter((c) => !used.has(c))];
}

describe('ladderRow', () => {
  it('splits the royal flush out of category 0', () => {
    expect(ladderRow(0, true)).toBe(0); // royal
    expect(ladderRow(0, false)).toBe(1); // straight flush
    expect(ladderRow(8, false)).toBe(9); // high card
  });
});

describe('summarizeHand', () => {
  it('marks the showdown winner and the folded hero', () => {
    // hero (btn) folds preflop-strength junk on the flop; SB flush beats BB
    const deck = riggedDeck(
      0,
      [
        ['9c', '4d'], // hero — will fold, ends with a pair of nines on this board
        ['Ah', 'Kh'], // SB — nut flush
        ['As', 'Ad'], // BB — set... no, pair of aces + board
      ],
      ['Qh', '9h', '2h', '7s', '3c'],
    );
    let { state } = startHandWithDeck(config([1000, 1000, 1000]), deck, 0, 'sum-test');
    state = applyAction(state, { type: 'call' }).state; // hero limp
    state = applyAction(state, { type: 'call' }).state; // SB
    state = applyAction(state, { type: 'check' }).state; // BB → flop
    state = applyAction(state, { type: 'raise', amount: 20 }).state; // SB bets
    state = applyAction(state, { type: 'call' }).state; // BB calls
    state = applyAction(state, { type: 'fold' }).state; // hero folds
    for (let i = 0; i < 4; i++) state = applyAction(state, { type: 'check' }).state; // turn+river
    expect(state.phase).toBe('complete');

    const summary = summarizeHand(state, true, [1], new Map([[1, 70]]));
    expect(summary.heroFolded).toBe(true);
    expect(summary.heroDescription).toBe('Pair of Nines'); // computed even though folded
    expect(summary.wonWithoutShowdown).toBe(false);
    expect(summary.winners[0].description).toContain('Flush');
    expect(summary.winners[0].category).toBe(3);
    expect(ladderRow(summary.winners[0].category!, summary.winners[0].isRoyal)).toBe(4);
  });

  it('fold-wins reveal nothing and preflop endings skip hero analysis', () => {
    const deck = riggedDeck(
      0,
      [
        ['9c', '4d'],
        ['Ah', 'Kh'],
        ['As', 'Ad'],
      ],
      ['Qh', '9h', '2h', '7s', '3c'],
    );
    let { state } = startHandWithDeck(config([1000, 1000, 1000]), deck, 0, 'sum-test-2');
    state = applyAction(state, { type: 'fold' }).state; // hero
    state = applyAction(state, { type: 'fold' }).state; // SB → BB wins blind
    expect(state.phase).toBe('complete');

    const summary = summarizeHand(state, false, [2], new Map([[2, 15]]));
    expect(summary.wonWithoutShowdown).toBe(true);
    expect(summary.heroCategory).toBeNull(); // no board — nothing to analyze
    expect(summary.winners[0].category).toBeNull(); // cards were never shown
    expect(summary.winners[0].name).toBe('P2');
  });
});
