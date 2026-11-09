import type { Card, GameState } from '../engine/types';
import { analyzeHand } from '../engine/handEval';

/**
 * End-of-hand study data: what the winner made, what the hero made (even
 * when folded), positioned on the classic hand-ranking ladder.
 */

export interface SummaryWinner {
  seatIndex: number;
  name: string;
  isHero: boolean;
  amount: number;
  /** analyzeHand category 0..8, or null when the hand never showed down. */
  category: number | null;
  description: string | null;
  isRoyal: boolean;
}

export interface HandSummary {
  handId: string;
  heroCards: [Card, Card];
  board: Card[];
  heroFolded: boolean;
  /** Hero's best made hand with the final board — null if the hand ended preflop. */
  heroCategory: number | null;
  heroDescription: string | null;
  heroIsRoyal: boolean;
  /** True when everyone folded and no cards were shown. */
  wonWithoutShowdown: boolean;
  /** True when the winner voluntarily flipped over a successful bluff. */
  bluffShown?: boolean;
  /** Main-pot winners. */
  winners: SummaryWinner[];
}

/**
 * Ladder row (0 = Royal Flush .. 9 = High Card) for a made hand. The display
 * ladder splits the royal flush out of category 0 the way every poker chart
 * players learn from does.
 */
export function ladderRow(category: number, isRoyal: boolean): number {
  return isRoyal ? 0 : category + 1;
}

export function summarizeHand(
  state: GameState,
  showdown: boolean,
  mainPotWinnerSeats: number[],
  amountsWon: Map<number, number>,
): HandSummary {
  const hero = state.players.find((p) => p.isHero);
  if (!hero) throw new Error('no hero at the table');
  const board = state.board;
  const canAnalyze = board.length >= 3;

  const heroAnalysis = canAnalyze ? analyzeHand([...hero.holeCards, ...board]) : null;

  const winners: SummaryWinner[] = mainPotWinnerSeats.map((seat) => {
    const p = state.players[seat];
    // A fold-win never reveals cards — no category to mark, and that's the lesson.
    const analysis = showdown && canAnalyze && !p.folded ? analyzeHand([...p.holeCards, ...board]) : null;
    return {
      seatIndex: seat,
      name: p.name,
      isHero: p.isHero,
      amount: amountsWon.get(seat) ?? 0,
      category: analysis?.category ?? null,
      description: analysis?.description ?? null,
      isRoyal: analysis?.description === 'Royal Flush',
    };
  });

  return {
    handId: state.handId,
    heroCards: hero.holeCards,
    board: [...board],
    heroFolded: hero.folded,
    heroCategory: heroAnalysis?.category ?? null,
    heroDescription: heroAnalysis?.description ?? null,
    heroIsRoyal: heroAnalysis?.description === 'Royal Flush',
    wonWithoutShowdown: !showdown,
    winners,
  };
}
