import type { Card, GameState, PlayerAction, PlayerState, TableConfig } from './types';
import type { HandEvent } from './events';
import { shuffledDeck } from './deck';
import { legalActions } from './bettingRules';
import { buildPots } from './potManager';
import { analyzeHand, evaluate7 } from './handEval';

export interface EngineResult {
  state: GameState;
  events: HandEvent[];
}

export class EngineError extends Error {}

/**
 * Starts a hand: shuffles from the seed, deals, posts blinds, and sets the
 * first player to act. If nobody can act (everyone all-in from the blinds)
 * the hand runs out to showdown immediately.
 */
export function startHand(config: TableConfig, seed: number, handId?: string): EngineResult {
  return startHandWithDeck(config, shuffledDeck(seed), seed, handId);
}

/**
 * Test seam: start a hand from an explicit deck order (first 2n cards are the
 * hole cards dealt round-robin from left of the button, then the board).
 * Production code must use startHand so hands stay replayable from the seed.
 */
export function startHandWithDeck(
  config: TableConfig,
  deck: Card[],
  seed = 0,
  handId?: string,
): EngineResult {
  const n = config.seats.length;
  if (n < 2 || n > 6) throw new EngineError(`Need 2-6 players, got ${n}`);
  if (
    !Number.isSafeInteger(config.smallBlind) ||
    !Number.isSafeInteger(config.bigBlind) ||
    config.smallBlind <= 0 ||
    config.bigBlind < config.smallBlind
  ) {
    throw new EngineError(`Invalid blinds ${config.smallBlind}/${config.bigBlind}`);
  }
  if (!Number.isInteger(config.buttonIndex) || config.buttonIndex < 0 || config.buttonIndex >= n) {
    throw new EngineError(`Invalid buttonIndex ${config.buttonIndex}`);
  }
  for (const s of config.seats) {
    if (!Number.isSafeInteger(s.stack) || s.stack <= 0) {
      throw new EngineError(`Invalid stack ${s.stack} for ${s.name}`);
    }
  }
  if (!Number.isSafeInteger(config.seats.reduce((sum, s) => sum + s.stack, 0))) {
    throw new EngineError('Total chips exceed safe integer precision');
  }
  if (deck.length !== 52 || new Set(deck).size !== 52 || deck.some((c) => !/^[2-9TJQKA][cdhs]$/.test(c))) {
    throw new EngineError('Deck must contain 52 distinct valid cards');
  }

  // Deal one card at a time, two rounds, starting left of the button.
  let deckIndex = 0;
  const dealt: Card[][] = config.seats.map(() => []);
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= n; i++) {
      dealt[(config.buttonIndex + i) % n].push(deck[deckIndex++]);
    }
  }

  const players: PlayerState[] = config.seats.map((s, i) => ({
    seatIndex: i,
    id: s.id,
    name: s.name,
    isHero: s.isHero,
    stack: s.stack,
    startingStack: s.stack,
    holeCards: [dealt[i][0], dealt[i][1]],
    folded: false,
    allIn: false,
    streetBet: 0,
    totalCommitted: 0,
    hasActed: false,
    lastActedBet: 0,
  }));

  const state: GameState = {
    handId: handId ?? `hand-${seed.toString(36)}`,
    config,
    seed,
    deck,
    deckIndex,
    players,
    buttonIndex: config.buttonIndex,
    phase: 'preflop',
    board: [],
    currentBet: config.bigBlind,
    lastRaiseAmount: config.bigBlind,
    actionOn: null,
    lastAggressor: null,
    actionHistory: [],
  };

  const events: HandEvent[] = [
    {
      type: 'handStarted',
      handId: state.handId,
      buttonIndex: state.buttonIndex,
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      players: players.map((p) => ({ seatIndex: p.seatIndex, id: p.id, name: p.name, stack: p.startingStack })),
    },
    {
      type: 'holeCardsDealt',
      cards: players.map((p) => ({ seatIndex: p.seatIndex, cards: p.holeCards })),
    },
  ];

  // Heads-up: the button is the small blind.
  const sbSeat = n === 2 ? state.buttonIndex : (state.buttonIndex + 1) % n;
  const bbSeat = (sbSeat + 1) % n;
  const sbPaid = commit(players[sbSeat], config.smallBlind);
  events.push({ type: 'blindPosted', seatIndex: sbSeat, kind: 'small', amount: sbPaid, allIn: players[sbSeat].allIn });
  const bbPaid = commit(players[bbSeat], config.bigBlind);
  events.push({ type: 'blindPosted', seatIndex: bbSeat, kind: 'big', amount: bbPaid, allIn: players[bbSeat].allIn });

  state.actionOn = findNextActor(state, bbSeat);
  if (state.actionOn === null) closeStreetLoop(state, events);
  return { state, events };
}

/**
 * Applies the given action for the player on action. Pure with respect to the
 * input state (returns a new state). Throws EngineError on illegal actions —
 * bots and UI must only produce actions from legalActions().
 */
export function applyAction(prev: GameState, action: PlayerAction): EngineResult {
  const la = legalActions(prev);
  if (!la) throw new EngineError('No action expected: hand is between streets or complete');

  const state = cloneState(prev);
  const p = state.players[la.seatIndex];
  const events: HandEvent[] = [];

  switch (action.type) {
    case 'fold': {
      p.folded = true;
      p.hasActed = true;
      events.push(actionEvent(p, 'fold', 0));
      break;
    }
    case 'check': {
      if (!la.check) throw new EngineError('Cannot check facing a bet');
      p.hasActed = true;
      events.push(actionEvent(p, 'check', 0));
      break;
    }
    case 'call': {
      if (!la.call) throw new EngineError('Nothing to call');
      const added = commit(p, la.call.amount);
      p.hasActed = true;
      events.push(actionEvent(p, 'call', added));
      break;
    }
    case 'raise': {
      if (!la.raise) throw new EngineError('Raise not available');
      const target = action.amount;
      if (
        target == null ||
        !Number.isSafeInteger(target) ||
        target < la.raise.minTo ||
        target > la.raise.maxTo
      ) {
        throw new EngineError(
          `Invalid raise-to ${target}; must be between ${la.raise.minTo} and ${la.raise.maxTo}`,
        );
      }
      const increment = target - state.currentBet;
      const added = commit(p, target - p.streetBet);
      state.currentBet = target;
      state.lastAggressor = p.seatIndex;
      if (increment >= state.lastRaiseAmount) {
        // Full raise: action re-opens for everyone still in.
        state.lastRaiseAmount = increment;
        for (const q of state.players) {
          if (q !== p && !q.folded && !q.allIn) q.hasActed = false;
        }
      }
      // Short raises do not reset flags; legalActions checks each player's cumulative increase.
      p.hasActed = true;
      events.push(actionEvent(p, 'raise', added));
      break;
    }
    default:
      throw new EngineError(`Unknown action type ${(action as PlayerAction).type}`);
  }

  p.lastActedBet = state.currentBet;

  state.actionHistory.push({ type: action.type, ...(action.amount != null ? { amount: action.amount } : {}) });

  // The hand ends the instant only one player remains — nobody else gets a
  // turn (otherwise the last player could "fold" and orphan the pot).
  if (state.players.filter((q) => !q.folded).length === 1) {
    closeStreetLoop(state, events);
    return { state, events };
  }

  const next = findNextActor(state, p.seatIndex);
  if (next !== null) {
    state.actionOn = next;
  } else {
    closeStreetLoop(state, events);
  }
  return { state, events };
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function actionEvent(p: PlayerState, action: PlayerAction['type'], amount: number): HandEvent {
  return { type: 'actionTaken', seatIndex: p.seatIndex, action, amount, toStreetBet: p.streetBet, allIn: p.allIn };
}

/** Moves up to `amount` chips from the player's stack into the pot. */
function commit(p: PlayerState, amount: number): number {
  const actual = Math.min(amount, p.stack);
  p.stack -= actual;
  p.streetBet += actual;
  p.totalCommitted += actual;
  if (p.stack === 0) p.allIn = true;
  return actual;
}

/**
 * Next seat that still needs to act this street, scanning clockwise after
 * fromSeat. A player needs to act if they haven't matched the current bet or
 * haven't acted since the last full raise (blinds don't count as acting).
 */
function findNextActor(state: GameState, fromSeat: number): number | null {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (fromSeat + i) % n;
    const p = state.players[seat];
    if (p.folded || p.allIn) continue;
    if (p.streetBet < state.currentBet || !p.hasActed) return seat;
  }
  return null;
}

/**
 * Called when a betting round has closed. Advances streets (dealing as it
 * goes), runs out the board when no more betting is possible, and resolves
 * the hand by folds or showdown.
 */
function closeStreetLoop(state: GameState, events: HandEvent[]): void {
  state.actionOn = null;
  for (;;) {
    const active = state.players.filter((p) => !p.folded);
    if (active.length === 1) {
      finishByFolds(state, events, active[0]);
      return;
    }
    if (state.phase === 'river') {
      showdown(state, events);
      return;
    }
    dealNextStreet(state, events);
    if (active.filter((p) => !p.allIn).length >= 2) {
      state.actionOn = findNextActor(state, state.buttonIndex);
      return;
    }
    // 0 or 1 players can still act — no betting possible, keep dealing.
  }
}

function dealNextStreet(state: GameState, events: HandEvent[]): void {
  const next = state.phase === 'preflop' ? 'flop' : state.phase === 'flop' ? 'turn' : 'river';
  const count = next === 'flop' ? 3 : 1;
  const cards = state.deck.slice(state.deckIndex, state.deckIndex + count);
  state.deckIndex += count;
  state.board = [...state.board, ...cards];
  state.phase = next;
  state.currentBet = 0;
  state.lastRaiseAmount = state.config.bigBlind;
  for (const p of state.players) {
    p.streetBet = 0;
    p.hasActed = false;
    p.lastActedBet = 0;
  }
  events.push({ type: 'streetDealt', street: next, cards, board: [...state.board] });
}

function returnUncalled(state: GameState, events: HandEvent[], uncalled: { seatIndex: number; amount: number }): void {
  const p = state.players[uncalled.seatIndex];
  p.stack += uncalled.amount;
  p.totalCommitted -= uncalled.amount;
  events.push({ type: 'uncalledBetReturned', seatIndex: uncalled.seatIndex, amount: uncalled.amount });
}

function finishByFolds(state: GameState, events: HandEvent[], winner: PlayerState): void {
  const { pots, uncalled } = buildPots(state.players);
  if (uncalled) returnUncalled(state, events, uncalled);
  const total = pots.reduce((sum, pot) => sum + pot.amount, 0);
  winner.stack += total;
  events.push({
    type: 'potAwarded',
    potIndex: 0,
    amount: total,
    winners: [{ seatIndex: winner.seatIndex, amount: total }],
  });
  completeHand(state, events);
}

function showdown(state: GameState, events: HandEvent[]): void {
  const contenders = state.players.filter((p) => !p.folded);
  const { pots, uncalled } = buildPots(state.players);
  if (uncalled) returnUncalled(state, events, uncalled);

  const results = new Map<number, { value: number; description: string }>();
  for (const p of contenders) {
    const seven = [...p.holeCards, ...state.board];
    results.set(p.seatIndex, {
      value: evaluate7(seven),
      description: analyzeHand(seven).description,
    });
  }

  events.push({
    type: 'showdown',
    reveals: contenders.map((p) => ({
      seatIndex: p.seatIndex,
      cards: p.holeCards,
      description: results.get(p.seatIndex)!.description,
    })),
  });

  pots.forEach((pot, potIndex) => {
    let best = Infinity;
    for (const seat of pot.eligible) best = Math.min(best, results.get(seat)!.value);
    const winnersSeats = pot.eligible.filter((seat) => results.get(seat)!.value === best);
    // Odd chips go to the first winner clockwise from the button.
    const ordered = [...winnersSeats].sort(
      (a, b) => clockwiseFromButton(state, a) - clockwiseFromButton(state, b),
    );
    const share = Math.floor(pot.amount / ordered.length);
    let remainder = pot.amount - share * ordered.length;
    const winners = ordered.map((seat) => {
      const amount = share + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      state.players[seat].stack += amount;
      return { seatIndex: seat, amount, description: results.get(seat)!.description };
    });
    events.push({ type: 'potAwarded', potIndex, amount: pot.amount, winners });
  });

  completeHand(state, events);
}

function clockwiseFromButton(state: GameState, seat: number): number {
  const n = state.players.length;
  return (seat - state.buttonIndex - 1 + 2 * n) % n;
}

function completeHand(state: GameState, events: HandEvent[]): void {
  state.phase = 'complete';
  state.actionOn = null;
  events.push({
    type: 'handComplete',
    results: state.players.map((p) => ({
      seatIndex: p.seatIndex,
      net: p.stack - p.startingStack,
      stack: p.stack,
    })),
  });
}

function cloneState(s: GameState): GameState {
  return {
    ...s,
    board: [...s.board],
    players: s.players.map((p) => ({ ...p })),
    actionHistory: [...s.actionHistory],
    // deck and config are never mutated after startHand — safe to share.
  };
}
