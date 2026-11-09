import { evaluateCards, rankCards } from 'phe';
import type { Card } from './types';
import { RANK_NAMES, rankIndex, rankNamePlural, suitIndex } from './deck';

/** Category indices match phe's rankCards: 0 = best category, 8 = worst. */
export const CATEGORY_NAMES = [
  'Straight Flush',
  'Four of a Kind',
  'Full House',
  'Flush',
  'Straight',
  'Three of a Kind',
  'Two Pair',
  'One Pair',
  'High Card',
] as const;

/** phe strength for 5–7 cards: 1 (royal flush) .. 7462 (worst high card). LOWER is better. */
export function evaluate7(cards: Card[]): number {
  return evaluateCards(cards);
}

/** Negative → a is better, positive → b is better, 0 → exact tie. */
export function compareHands(a: Card[], b: Card[]): number {
  return evaluateCards(a) - evaluateCards(b);
}

/** Category index 0..8 straight from phe (used to cross-check analyzeHand). */
export function handCategory(cards: Card[]): number {
  return rankCards(cards);
}

export interface HandAnalysis {
  /** 0 = straight flush .. 8 = high card (same indexing as phe rankCards). */
  category: number;
  categoryName: string;
  /** Human string, e.g. "Two Pair, Kings and Nines". */
  description: string;
}

/**
 * Best straight within the given rank presence; returns the high card's rank
 * index (3 = five-high wheel .. 12 = ace-high broadway) or -1 if none.
 */
function bestStraightHigh(present: boolean[]): number {
  for (let hi = 12; hi >= 3; hi--) {
    let ok = true;
    for (let k = 0; k < 5; k++) {
      const r = hi - k;
      const idx = r === -1 ? 12 : r; // wheel uses the ace as the low end
      if (!present[idx]) {
        ok = false;
        break;
      }
    }
    if (ok) return hi;
  }
  return -1;
}

/**
 * Independent 5–7 card analyzer producing the category and a human description.
 * Cross-validated against phe's rankCards in tests — comparisons between hands
 * should always use evaluate7/compareHands, not this.
 */
export function analyzeHand(cards: Card[]): HandAnalysis {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`analyzeHand needs 5-7 cards, got ${cards.length}`);
  }
  const rankCounts = new Array<number>(13).fill(0);
  const suitCounts = [0, 0, 0, 0];
  for (const c of cards) {
    rankCounts[rankIndex(c)]++;
    suitCounts[suitIndex(c)]++;
  }
  const present = rankCounts.map((n) => n > 0);
  const flushSuit = suitCounts.findIndex((n) => n >= 5);
  const flushPresent = new Array<boolean>(13).fill(false);
  if (flushSuit >= 0) {
    for (const c of cards) {
      if (suitIndex(c) === flushSuit) flushPresent[rankIndex(c)] = true;
    }
  }

  /** Ranks with at least `min` copies, best first. */
  const ranksWith = (min: number): number[] => {
    const out: number[] = [];
    for (let r = 12; r >= 0; r--) if (rankCounts[r] >= min) out.push(r);
    return out;
  };
  const result = (category: number, description: string): HandAnalysis => ({
    category,
    categoryName: CATEGORY_NAMES[category],
    description,
  });

  if (flushSuit >= 0) {
    const sfHigh = bestStraightHigh(flushPresent);
    if (sfHigh === 12) return result(0, 'Royal Flush');
    if (sfHigh >= 0) return result(0, `Straight Flush, ${RANK_NAMES[sfHigh]} high`);
  }
  const quads = ranksWith(4);
  if (quads.length > 0) return result(1, `Four of a Kind, ${rankNamePlural(quads[0])}`);
  const trips = ranksWith(3);
  if (trips.length > 0) {
    const pairPart = ranksWith(2).filter((r) => r !== trips[0]);
    if (pairPart.length > 0) {
      return result(2, `Full House, ${rankNamePlural(trips[0])} full of ${rankNamePlural(pairPart[0])}`);
    }
  }
  if (flushSuit >= 0) {
    let hi = 12;
    while (!flushPresent[hi]) hi--;
    return result(3, `Flush, ${RANK_NAMES[hi]} high`);
  }
  const straightHigh = bestStraightHigh(present);
  if (straightHigh >= 0) return result(4, `Straight, ${RANK_NAMES[straightHigh]} high`);
  if (trips.length > 0) return result(5, `Three of a Kind, ${rankNamePlural(trips[0])}`);
  const pairs = ranksWith(2);
  if (pairs.length >= 2) return result(6, `Two Pair, ${rankNamePlural(pairs[0])} and ${rankNamePlural(pairs[1])}`);
  if (pairs.length === 1) return result(7, `Pair of ${rankNamePlural(pairs[0])}`);
  const hi = ranksWith(1)[0];
  return result(8, `${RANK_NAMES[hi]} high`);
}
