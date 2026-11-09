declare module 'phe' {
  /** Evaluates 5, 6 or 7 cards (e.g. ['As','Ks','Qs','Js','Ts']) → strength 1..7462, LOWER is better. */
  export function evaluateCards(cards: string[]): number;
  export function evaluateCardsFast(cards: string[]): number;
  export function evaluateCardCodes(codes: number[]): number;
  /** Category index for the cards: 0 = straight flush .. 8 = high card. */
  export function rankCards(cards: string[]): number;
  export function rankCardCodes(codes: number[]): number;
  /** Converts a strength from evaluateCards to a category index. */
  export function handRank(strength: number): number;
  export function cardCodes(cards: string[]): number[];
  export function cardCode(card: string): number;
  export const rankDescription: string[];
}
