import { describe, expect, it } from 'vitest';
import type { Card, TableConfig } from '../engine/types';
import { applyAction, startHandWithDeck } from '../engine/gameStateMachine';
import { freshDeck } from '../engine/deck';
import { buildBotView } from '../bots/botDecision';
import { monteCarloEquity } from '../equity/monteCarlo';
import { postflopAdvice, preflopAdvice } from './recommend';

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
  const rest = freshDeck().filter((c) => !used.has(c));
  return [...deal, ...board, ...rest];
}

const BOARD = ['Kd', '8c', '2s', '6h', 'Jc'];

describe('preflop coach', () => {
  it('folds 72o under the gun', () => {
    // 4-handed, button 0 → seat 3 is UTG (first to act)
    const deck = riggedDeck(0, [['Ac', 'Kc'], ['5c', '5d'], ['9h', '9c'], ['7h', '2c']], BOARD);
    const { state } = startHandWithDeck(config([1000, 1000, 1000, 1000]), deck);
    const advice = preflopAdvice(buildBotView(state, 3));
    expect(advice.action).toBe('fold');
    expect(advice.headline).toContain('72o');
  });

  it('opens T9s from the button', () => {
    const deck = riggedDeck(1, [['5c', '5d'], ['Th', '9h'], ['Ah', '2c'], ['Kh', '4s']], BOARD);
    // button 1 → seat 0 is... seats from button+1: SB=2, BB=3, UTG=0? 4-handed: BTN=1, SB=2, BB=3, UTG=0.
    const { state } = startHandWithDeck(config([1000, 1000, 1000, 1000], 1), deck);
    // UTG (seat 0) folds first, then it's the button's turn
    const afterUtg = applyAction(state, { type: 'fold' }).state;
    expect(afterUtg.actionOn).toBe(1);
    const advice = preflopAdvice(buildBotView(afterUtg, 1));
    expect(advice.headline).toContain('T9s');
    expect(advice.action).toBe('raise');
    expect(advice.raiseTo).toBe(30);
  });

  it('3-bets aces facing a raise', () => {
    const deck = riggedDeck(0, [['As', 'Ah'], ['Kh', 'Qh'], ['5c', '5d'], ['9h', '8h']], BOARD);
    let { state } = startHandWithDeck(config([1000, 1000, 1000, 1000]), deck);
    // UTG (seat 3) raises to 30, then it's the button (seat 0, our hero with aces)
    state = applyAction(state, { type: 'raise', amount: 30 }).state;
    expect(state.actionOn).toBe(0);
    const advice = preflopAdvice(buildBotView(state, 0));
    expect(advice.action).toBe('raise');
    expect(advice.raiseTo).toBe(90);
  });
});

describe('postflop coach', () => {
  it('calls with a strong draw at a good price', () => {
    // hero flush draw on the flop, small bet: equity ~38% vs ~17% required
    const view = {
      seatIndex: 0,
      holeCards: ['Ah', '9h'] as [Card, Card],
      board: ['Kh', '7h', '2c'],
      phase: 'flop' as const,
      position: 'BTN' as const,
      pot: 100,
      toCall: 20,
      currentBet: 20,
      myStreetBet: 0,
      myStack: 500,
      bigBlind: 10,
      legal: { seatIndex: 0, fold: true, check: false, call: { amount: 20, allIn: false }, raise: { minTo: 40, maxTo: 500 } },
      numActive: 2,
    };
    const eq = monteCarloEquity({ hero: view.holeCards, board: view.board, opponents: 1, iterations: 10_000, seed: 9 });
    const advice = postflopAdvice(view, eq);
    expect(['call', 'raise']).toContain(advice.action);
    expect(advice.requiredEquity).toBeCloseTo(20 / 120, 5);
  });

  it('folds air against a big bet', () => {
    const view = {
      seatIndex: 0,
      holeCards: ['5d', '4c'] as [Card, Card],
      board: ['Kh', 'Qh', '9c', '2s'],
      phase: 'turn' as const,
      position: 'BB' as const,
      pot: 300,
      toCall: 250,
      currentBet: 250,
      myStreetBet: 0,
      myStack: 800,
      bigBlind: 10,
      legal: { seatIndex: 0, fold: true, check: false, call: { amount: 250, allIn: false }, raise: { minTo: 500, maxTo: 800 } },
      numActive: 2,
    };
    const eq = monteCarloEquity({ hero: view.holeCards, board: view.board, opponents: 1, iterations: 10_000, seed: 10 });
    const advice = postflopAdvice(view, eq);
    expect(advice.action).toBe('fold');
  });

  it('bets a strong made hand when checked to', () => {
    const view = {
      seatIndex: 0,
      holeCards: ['Kh', 'Kd'] as [Card, Card],
      board: ['Ks', '7h', '2c'],
      phase: 'flop' as const,
      position: 'BTN' as const,
      pot: 60,
      toCall: 0,
      currentBet: 0,
      myStreetBet: 0,
      myStack: 900,
      bigBlind: 10,
      legal: { seatIndex: 0, fold: true, check: true, raise: { minTo: 10, maxTo: 900 } },
      numActive: 3,
    };
    const eq = monteCarloEquity({ hero: view.holeCards, board: view.board, opponents: 2, iterations: 10_000, seed: 11 });
    const advice = postflopAdvice(view, eq);
    expect(advice.action).toBe('raise');
    expect(advice.headline).toContain('value');
  });
});
