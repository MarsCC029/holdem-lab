import { describe, expect, it } from 'vitest';
import type { Card, GameState, TableConfig } from './types';
import { totalPot } from './types';
import { applyAction, startHand, startHandWithDeck } from './gameStateMachine';
import { legalActions } from './bettingRules';
import { freshDeck } from './deck';
import type { HandEvent } from './events';

function config(stacks: number[], buttonIndex = 0): TableConfig {
  return {
    smallBlind: 5,
    bigBlind: 10,
    buttonIndex,
    seats: stacks.map((stack, i) => ({ id: `p${i}`, name: `P${i}`, stack, isHero: i === 0 })),
  };
}

/**
 * Builds a deck that deals the given hole cards (indexed by seat) and board.
 * Mirrors the engine's dealing order: one card per seat starting left of the
 * button, two rounds, then the board comes right after.
 */
function riggedDeck(
  buttonIndex: number,
  holes: [Card, Card][],
  board: Card[],
): Card[] {
  const n = holes.length;
  const deal: Card[] = [];
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= n; i++) {
      deal.push(holes[(buttonIndex + i) % n][round]);
    }
  }
  const used = new Set([...deal, ...board]);
  for (const c of used) {
    if (c.length !== 2) throw new Error(`bad card ${c}`);
  }
  if (used.size !== deal.length + board.length) throw new Error('duplicate cards in rig');
  const rest = freshDeck().filter((c) => !used.has(c));
  return [...deal, ...board, ...rest];
}

function act(state: GameState, type: 'fold' | 'check' | 'call'): GameState;
function act(state: GameState, type: 'raise', amount: number): GameState;
function act(state: GameState, type: 'fold' | 'check' | 'call' | 'raise', amount?: number): GameState {
  return applyAction(state, amount != null ? { type: type as 'raise', amount } : { type }).state;
}

function stacks(state: GameState): number[] {
  return state.players.map((p) => p.stack);
}

describe('startHand basics', () => {
  it('posts blinds and starts action left of the BB (3-handed: the button)', () => {
    const { state } = startHand(config([1000, 1000, 1000]), 42);
    expect(state.players[1].streetBet).toBe(5); // SB
    expect(state.players[2].streetBet).toBe(10); // BB
    expect(state.currentBet).toBe(10);
    expect(state.actionOn).toBe(0); // button acts first 3-handed preflop
    expect(totalPot(state)).toBe(15);
  });

  it('heads-up: button posts the small blind and acts first preflop', () => {
    const { state } = startHand(config([1000, 1000], 0), 42);
    expect(state.players[0].streetBet).toBe(5); // button = SB
    expect(state.players[1].streetBet).toBe(10);
    expect(state.actionOn).toBe(0);
  });

  it('heads-up: BB acts first postflop', () => {
    let { state } = startHand(config([1000, 1000], 0), 42);
    state = act(state, 'call');
    state = act(state, 'check');
    expect(state.phase).toBe('flop');
    expect(state.actionOn).toBe(1); // BB first postflop heads-up
  });

  it('runs out immediately when the blinds put everyone all-in', () => {
    const { state, events } = startHand(config([5, 10], 0), 7);
    expect(state.phase).toBe('complete');
    expect(state.board).toHaveLength(5);
    // BB's unmatched 5 must have been returned before showdown
    expect(events.some((e) => e.type === 'uncalledBetReturned' && e.seatIndex === 1 && e.amount === 5)).toBe(true);
    expect(stacks(state).reduce((a, b) => a + b)).toBe(15);
  });
});

describe('fold-outs and uncalled bets', () => {
  it('folding around to the BB awards the blinds without showdown', () => {
    let { state } = startHand(config([1000, 1000, 1000]), 42);
    state = act(state, 'fold'); // button
    state = act(state, 'fold'); // SB
    expect(state.phase).toBe('complete');
    expect(stacks(state)).toEqual([1000, 995, 1005]);
  });

  it('an uncalled postflop bet is returned to the bettor', () => {
    let { state } = startHand(config([1000, 1000, 1000]), 42);
    state = act(state, 'call'); // button calls 10
    state = act(state, 'call'); // SB completes
    state = act(state, 'check'); // BB checks
    expect(state.phase).toBe('flop');
    expect(state.actionOn).toBe(1); // SB first postflop
    state = act(state, 'raise', 25); // SB bets 25
    state = act(state, 'fold'); // BB folds
    state = act(state, 'fold'); // button folds
    expect(state.phase).toBe('complete');
    // SB wins pot of 30, gets the 25 back: 1000 - 10 + 30 = 1020
    expect(stacks(state)).toEqual([990, 1020, 990]);
  });
});

describe('betting rules', () => {
  it('BB gets the option and a full BB raise re-opens action', () => {
    let { state } = startHand(config([1000, 1000, 1000]), 42);
    state = act(state, 'call');
    state = act(state, 'call');
    expect(state.actionOn).toBe(2); // BB has the option
    const la = legalActions(state)!;
    expect(la.check).toBe(true);
    expect(la.raise).toEqual({ minTo: 20, maxTo: 1000 });
    state = act(state, 'raise', 40);
    // action re-opened: button must respond
    expect(state.actionOn).toBe(0);
    expect(legalActions(state)!.raise).toEqual({ minTo: 70, maxTo: 1000 });
  });

  it('min-raise tracks the last full raise increment', () => {
    let { state } = startHand(config([1000, 1000, 1000]), 42);
    state = act(state, 'raise', 30); // button opens to 30 (increment 20)
    const la = legalActions(state)!; // SB facing 30
    expect(la.raise!.minTo).toBe(50); // 30 + 20
    expect(() => applyAction(state, { type: 'raise', amount: 49 })).toThrow();
  });

  it('a short all-in raise does not re-open action for players who acted', () => {
    // BB is short: raising all-in above a full raise by less than the increment
    let { state } = startHand(config([1000, 1000, 35], 0), 42);
    state = act(state, 'raise', 30); // button opens to 30 (full raise, increment 20)
    state = act(state, 'call'); // SB calls 30
    state = act(state, 'raise', 35); // BB all-in for 35: increment 5 < 20 → short
    expect(state.players[2].allIn).toBe(true);
    // Button already acted: may call 5 or fold, but NOT raise
    expect(state.actionOn).toBe(0);
    const laButton = legalActions(state)!;
    expect(laButton.call).toEqual({ amount: 5, allIn: false });
    expect(laButton.raise).toBeUndefined();
    state = act(state, 'call');
    const laSB = legalActions(state)!;
    expect(laSB.raise).toBeUndefined();
    state = act(state, 'call');
    expect(state.phase).toBe('flop');
  });

  it('a full all-in raise DOES re-open action', () => {
    let { state } = startHand(config([1000, 1000, 100], 0), 42);
    state = act(state, 'raise', 30); // button opens (increment 20)
    state = act(state, 'call'); // SB calls
    state = act(state, 'raise', 100); // BB all-in: increment 70 >= 20 → full raise
    expect(state.actionOn).toBe(0);
    const la = legalActions(state)!;
    expect(la.raise).toEqual({ minTo: 170, maxTo: 1000 });
  });

  it('cannot check facing a bet, cannot raise beyond stack', () => {
    let { state } = startHand(config([1000, 1000, 1000]), 42);
    state = act(state, 'raise', 30);
    expect(() => applyAction(state, { type: 'check' })).toThrow();
    expect(() => applyAction(state, { type: 'raise', amount: 1500 })).toThrow();
  });
});

describe('showdown and side pots (rigged decks)', () => {
  it('best hand wins a checked-down pot', () => {
    const deck = riggedDeck(
      0,
      [
        ['Ah', 'Ad'], // seat 0 (button): aces → wins
        ['Kh', 'Kd'], // seat 1 SB
        ['7h', '2c'], // seat 2 BB
      ],
      ['3c', '8d', 'Jh', '4s', '9s'],
    );
    let { state } = startHandWithDeck(config([1000, 1000, 1000]), deck);
    state = act(state, 'call');
    state = act(state, 'call');
    state = act(state, 'check');
    for (const street of ['flop', 'turn', 'river']) {
      expect(state.phase).toBe(street);
      state = act(state, 'check'); // SB
      state = act(state, 'check'); // BB
      state = act(state, 'check'); // button
    }
    expect(state.phase).toBe('complete');
    expect(stacks(state)).toEqual([1020, 990, 990]);
  });

  it('3-way all-in builds main and side pots correctly', () => {
    // Seat 0 (button, 100): best hand — wins main pot only.
    // Seat 1 (SB, 250): second best — wins side pot.
    // Seat 2 (BB, 600): worst — gets uncalled excess back.
    const deck = riggedDeck(
      0,
      [
        ['Ah', 'Ad'],
        ['Kh', 'Kd'],
        ['Qh', 'Qd'],
      ],
      ['3c', '8d', 'Jh', '4s', '9s'],
    );
    let { state } = startHandWithDeck(config([100, 250, 600]), deck);
    state = act(state, 'raise', 100); // button all-in
    state = act(state, 'raise', 250); // SB all-in (increment 150 ≥ 90: full)
    state = act(state, 'call'); // BB calls 250
    expect(state.phase).toBe('complete');
    // main: 300 → seat 0; side: 300 → seat 1; seat 2 keeps 350
    expect(stacks(state)).toEqual([300, 300, 350]);
  });

  it('split pot gives the odd chip to the first seat left of the button', () => {
    // Board plays for both remaining players; pot is 25 (limp 10 + SB fold 5 + BB 10)
    const deck = riggedDeck(
      0,
      [
        ['2h', '3d'], // button
        ['7s', '8s'], // SB (folds)
        ['2c', '3s'], // BB
      ],
      ['Ah', 'Kh', 'Qc', 'Jd', 'Tc'], // broadway on board — everyone plays the board
    );
    let { state } = startHandWithDeck(config([1000, 1000, 1000]), deck);
    state = act(state, 'call'); // button limps 10
    state = act(state, 'fold'); // SB folds (5 dead)
    state = act(state, 'check'); // BB
    for (let street = 0; street < 3; street++) {
      state = act(state, 'check'); // BB first postflop
      state = act(state, 'check'); // button
    }
    expect(state.phase).toBe('complete');
    // pot 25 split: BB (first left of button) gets 13, button 12
    expect(stacks(state)).toEqual([1002, 995, 1003]);
  });

  it('folded chips are in the pot but folder cannot win', () => {
    const deck = riggedDeck(
      0,
      [
        ['Ah', 'Ad'], // button — folds later despite best cards
        ['Kh', 'Kd'], // SB
        ['Qh', 'Qd'], // BB
      ],
      ['3c', '8d', 'Jh', '4s', '9s'],
    );
    let { state } = startHandWithDeck(config([1000, 1000, 1000]), deck);
    state = act(state, 'raise', 30);
    state = act(state, 'call');
    state = act(state, 'call');
    expect(state.phase).toBe('flop');
    state = act(state, 'raise', 45); // SB bets
    state = act(state, 'call'); // BB calls
    state = act(state, 'fold'); // button folds his aces
    for (let street = 0; street < 2; street++) {
      state = act(state, 'check');
      state = act(state, 'check');
    }
    expect(state.phase).toBe('complete');
    // pot = 30*3 + 45*2 = 180 → SB (kings) wins
    expect(stacks(state)).toEqual([970, 1105, 925]);
  });
});

describe('lastAggressor tracking', () => {
  it('records the last bettor/raiser and carries initiative across streets', () => {
    let { state } = startHand(config([1000, 1000, 1000]), 42);
    expect(state.lastAggressor).toBeNull(); // blinds don't count
    state = act(state, 'raise', 30); // button opens
    expect(state.lastAggressor).toBe(0);
    state = act(state, 'call');
    state = act(state, 'call');
    expect(state.phase).toBe('flop');
    expect(state.lastAggressor).toBe(0); // preflop raiser keeps initiative
    state = act(state, 'check'); // SB
    state = act(state, 'raise', 25); // BB bets the flop
    expect(state.lastAggressor).toBe(2);
  });
});

describe('event log', () => {
  it('emits a coherent sequence for a simple hand', () => {
    const { state, events } = startHand(config([1000, 1000, 1000]), 42);
    const types = events.map((e) => e.type);
    expect(types).toEqual(['handStarted', 'holeCardsDealt', 'blindPosted', 'blindPosted']);
    const r1 = applyAction(state, { type: 'fold' });
    const r2 = applyAction(r1.state, { type: 'fold' });
    const endTypes = r2.events.map((e: HandEvent) => e.type);
    expect(endTypes).toEqual(['actionTaken', 'uncalledBetReturned', 'potAwarded', 'handComplete']);
  });
});
