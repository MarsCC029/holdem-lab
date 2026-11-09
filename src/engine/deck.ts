import type { Card } from './types';
import { mulberry32, shuffleInPlace } from './rng';

export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';

export const RANK_NAMES = [
  'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace',
] as const;

export function rankNamePlural(rankIdx: number): string {
  const name = RANK_NAMES[rankIdx];
  return name === 'Six' ? 'Sixes' : `${name}s`;
}

export function makeCard(rankIdx: number, suitIdx: number): Card {
  return RANKS[rankIdx] + SUITS[suitIdx];
}

/** 0..12 where 0 = Two, 12 = Ace. */
export function rankIndex(card: Card): number {
  const i = RANKS.indexOf(card[0]);
  if (i === -1) throw new Error(`Invalid card rank: ${card}`);
  return i;
}

/** 0..3 for c, d, h, s. */
export function suitIndex(card: Card): number {
  const i = SUITS.indexOf(card[1]);
  if (i === -1) throw new Error(`Invalid card suit: ${card}`);
  return i;
}

/** All 52 cards in canonical order. */
export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      deck.push(makeCard(r, s));
    }
  }
  return deck;
}

/** Deterministically shuffled 52-card deck for the given seed. */
export function shuffledDeck(seed: number): Card[] {
  return shuffleInPlace(freshDeck(), mulberry32(seed));
}
