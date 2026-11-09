import type { Card } from '../engine/types';
import { RANKS, rankIndex, suitIndex } from '../engine/deck';

/**
 * 169-hand preflop grid bucketed into tiers 1 (premium) .. 8 (junk).
 * Rows/cols run A,K,Q,...,2. Diagonal = pairs, upper-right = suited,
 * lower-left = offsuit. Tuning data — personalities compare their positional
 * threshold against these tiers.
 */
const TIER_GRID = [
  '1122344444444', // A: AA AKs AQs AJs ATs A9s..A2s
  '2123456666666', // K: AKo KK KQs KJs KTs K9s K8s..K2s
  '3413456777777', // Q
  '4552345677777', // J
  '5665245678888', // T
  '6776634567888', // 9
  '6887763567888', // 8
  '6888877456888', // 7
  '7888888745688', // 6
  '7888888875578', // 5
  '7888888888578', // 4
  '7888888888858', // 3
  '7888888888885', // 2
] as const;

/** Grid coordinate for a rank index (12 = Ace → row 0). */
function gridIdx(rankIdx: number): number {
  return 12 - rankIdx;
}

/** Tier 1 (best) .. 8 (worst) for a starting hand. */
export function handTier(cards: [Card, Card]): number {
  const r1 = rankIndex(cards[0]);
  const r2 = rankIndex(cards[1]);
  const suited = suitIndex(cards[0]) === suitIndex(cards[1]);
  if (r1 === r2) {
    return Number(TIER_GRID[gridIdx(r1)][gridIdx(r1)]);
  }
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  // higher rank has the smaller grid index; suited hands live upper-right
  const row = suited ? gridIdx(hi) : gridIdx(lo);
  const col = suited ? gridIdx(lo) : gridIdx(hi);
  return Number(TIER_GRID[row][col]);
}

/** Canonical label like 'AKs', 'QQ', 'T9o'. */
export function handLabel(cards: [Card, Card]): string {
  const r1 = rankIndex(cards[0]);
  const r2 = rankIndex(cards[1]);
  if (r1 === r2) return RANKS[r1] + RANKS[r2];
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const suited = suitIndex(cards[0]) === suitIndex(cards[1]);
  return RANKS[hi] + RANKS[lo] + (suited ? 's' : 'o');
}
