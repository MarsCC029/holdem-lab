/**
 * Core engine types. This module (and everything under src/engine) is pure
 * TypeScript with no React/DOM dependencies — fully deterministic and testable.
 *
 * Chips are always integers. A hand is fully determined by {config, seed, actions[]}.
 */

/** Card as a 2-char string: rank in '23456789TJQKA' + suit in 'cdhs', e.g. 'As', 'Td'. */
export type Card = string;

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type GamePhase = Street | 'complete';

export type Position = 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO';

export interface SeatConfig {
  id: string;
  name: string;
  stack: number;
  isHero: boolean;
  /** Bot personality id; undefined for the human player. */
  personalityId?: string;
}

export interface TableConfig {
  smallBlind: number;
  bigBlind: number;
  /** Index into `seats` of the dealer button for this hand. */
  buttonIndex: number;
  /** Players dealt into this hand, in seat order. All stacks must be > 0. */
  seats: SeatConfig[];
}

export interface PlayerState {
  seatIndex: number;
  id: string;
  name: string;
  isHero: boolean;
  /** Chips behind (excludes chips already committed). */
  stack: number;
  /** Stack at the start of the hand — net result = stack - startingStack once complete. */
  startingStack: number;
  holeCards: [Card, Card];
  folded: boolean;
  allIn: boolean;
  /** Chips committed during the current betting round. */
  streetBet: number;
  /** Total chips committed this hand (drives side pots). */
  totalCommitted: number;
  /**
   * Whether this player has acted since the last FULL raise this street.
   * Blinds do not count as acting. Full raises reset this flag; cumulative
   * short raises may independently restore raise rights via lastActedBet.
   */
  hasActed: boolean;
  /** Bet level faced on the most recent action; cumulative short raises can reopen action. */
  lastActedBet?: number;
}

export type ActionType = 'fold' | 'check' | 'call' | 'raise';

export interface PlayerAction {
  type: ActionType;
  /** For 'raise': the total street amount to raise TO (not the increment). */
  amount?: number;
}

export interface LegalActions {
  seatIndex: number;
  fold: boolean;
  check: boolean;
  /** Chips to add to call (already capped at stack). */
  call?: { amount: number; allIn: boolean };
  /** Raise-to totals. maxTo is all-in. minTo === maxTo means all-in is the only raise. */
  raise?: { minTo: number; maxTo: number };
}

export interface GameState {
  handId: string;
  config: TableConfig;
  seed: number;
  /** Full shuffled deck order. Private — never expose to UI or bots. */
  deck: Card[];
  deckIndex: number;
  players: PlayerState[];
  buttonIndex: number;
  phase: GamePhase;
  board: Card[];
  /** Highest streetBet this round. */
  currentBet: number;
  /** Size of the last full bet/raise increment — the min-raise basis. */
  lastRaiseAmount: number;
  /** Seat index to act, or null (between streets / hand complete). */
  actionOn: number | null;
  /**
   * Last player to bet or raise this hand (blinds don't count). Public
   * information — everyone at the table saw it. Drives bot initiative
   * (continuation bets) without leaking anything private.
   */
  lastAggressor: number | null;
  /** Ordered actions applied so far — replaying these on {config, seed} rebuilds any state. */
  actionHistory: PlayerAction[];
}

/** Sum of all chips committed to the pot this hand. */
export function totalPot(state: GameState): number {
  return state.players.reduce((sum, p) => sum + p.totalCommitted, 0);
}

/** Positions for the given player count, ordered from the button clockwise. */
export function positionOfSeat(state: GameState, seatIndex: number): Position {
  const n = state.players.length;
  const offset = (seatIndex - state.buttonIndex + n) % n;
  if (n === 2) return offset === 0 ? 'SB' : 'BB'; // heads-up: button is SB
  const byOffset: Record<number, Position[]> = {
    3: ['BTN', 'SB', 'BB'],
    4: ['BTN', 'SB', 'BB', 'UTG'],
    5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
    6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  };
  return byOffset[n][offset];
}
