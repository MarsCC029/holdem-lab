import type { Card } from '../engine/types';

const SUIT_SYMBOL: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };

export function suitSymbol(card: Card): string {
  return SUIT_SYMBOL[card[1]];
}

export function rankLabel(card: Card): string {
  return card[0] === 'T' ? '10' : card[0];
}

export function formatCard(card: Card): string {
  return rankLabel(card) + suitSymbol(card);
}

export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(' ');
}

export function isRedSuit(card: Card): boolean {
  return card[1] === 'h' || card[1] === 'd';
}

export function formatChips(n: number): string {
  return n.toLocaleString('en-US');
}
