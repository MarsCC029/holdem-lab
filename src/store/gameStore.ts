import { create } from 'zustand';
import type { ActionType, Card, GamePhase, LegalActions } from '../engine/types';
import type { CoachAdvice } from '../coach/recommend';
import type { HandGrade } from '../analysis/gradeHand';
import type { HandSummary } from '../analysis/handSummary';

/**
 * UI-facing snapshot of the table. SANITIZED: bot hole cards are null until
 * showdown reveals them — components physically cannot leak what they don't
 * receive. Only the table controller writes to this store.
 */
export interface SeatView {
  seatIndex: number;
  id: string;
  name: string;
  isHero: boolean;
  avatar: string;
  personalityTagline: string | null;
  stack: number;
  streetBet: number;
  folded: boolean;
  allIn: boolean;
  /** Visible cards: hero always; bots only at showdown. */
  holeCards: [Card, Card] | null;
  /** Whether this seat holds (face-down) cards right now. */
  hasCards: boolean;
  isButton: boolean;
  isActing: boolean;
  lastAction: { type: ActionType | 'bet' | 'small blind' | 'big blind'; amount: number } | null;
  /** Showdown hand description, e.g. "Two Pair, Kings and Nines". */
  showdownDescription: string | null;
  wonAmount: number | null;
  sittingOut: boolean;
}

export type TableStatus = 'idle' | 'playing' | 'handComplete' | 'heroBusted';

export interface GameViewState {
  status: TableStatus;
  handNumber: number;
  phase: GamePhase | null;
  seats: SeatView[];
  board: Card[];
  pot: number;
  bigBlind: number;
  /** Non-null exactly when the UI should show the action bar. */
  heroLegal: LegalActions | null;
  /** Live coach advice for the current hero decision (null = hidden). */
  coach: CoachAdvice | null;
  /** Post-hand review of the hero's decisions (null until graded). */
  review: HandGrade | null;
  /** End-of-hand study screen data. */
  summary: HandSummary | null;
  /** True while the game is paused waiting for "deal next hand". */
  awaitingNext: boolean;
  /** One-liner banner at hand end, e.g. "Selena wins 300 with a flush". */
  banner: string | null;
  /** Rolling human-readable action log (most recent last). */
  log: string[];
  /** Active table-talk bubbles by seat index. */
  quips: Record<number, { text: string; id: number }>;
}

const initialState: GameViewState = {
  status: 'idle',
  handNumber: 0,
  phase: null,
  seats: [],
  board: [],
  pot: 0,
  bigBlind: 10,
  heroLegal: null,
  coach: null,
  review: null,
  summary: null,
  awaitingNext: false,
  banner: null,
  log: [],
  quips: {},
};

interface GameStore extends GameViewState {
  /** Controller-only: replace the snapshot. */
  publish: (partial: Partial<GameViewState>) => void;
  appendLog: (lines: string[]) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()((set) => ({
  ...initialState,
  publish: (partial) => set(partial),
  appendLog: (lines) =>
    set((s) => ({ log: [...s.log, ...lines].slice(-200) })),
  reset: () => set(initialState),
}));
