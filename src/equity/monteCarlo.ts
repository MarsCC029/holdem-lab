import { cardCodes, evaluateCardCodes } from 'phe';
import type { Card } from '../engine/types';
import { freshDeck } from '../engine/deck';
import { mulberry32, randInt, randomSeed } from '../engine/rng';

/** Precomputed phe codes for all 52 cards. */
const CODE = new Map<Card, number>(
  (() => {
    const deck = freshDeck();
    const codes = cardCodes(deck);
    return deck.map((c, i) => [c, codes[i]] as [Card, number]);
  })(),
);

export interface EquityOptions {
  hero: [Card, Card];
  board: Card[];
  /** Number of opponents holding unknown (random) hands. */
  opponents: number;
  /** Opponents with known hands (drills, tests, modeled reads). */
  knownOpponents?: [Card, Card][];
  iterations: number;
  /** Fixed seed for reproducible results (tests). */
  seed?: number;
}

export interface EquityResult {
  /** Hero's expected share of the pot, 0..1 (ties split fractionally). */
  equity: number;
  /** Fraction of iterations hero wins outright. */
  win: number;
  /** Fraction of iterations hero ties for best. */
  tie: number;
  iterations: number;
}

/**
 * Monte Carlo equity: deals random completions of the board and random
 * opponent hands, evaluates everyone with phe, and tallies hero's pot share.
 * Pure and synchronous — run it inside the web worker for UI use; call it
 * directly in tests. ~5,000 iterations ≈ ±0.7% standard error.
 */
export function monteCarloEquity(opts: EquityOptions): EquityResult {
  const { hero, board, opponents, knownOpponents = [], iterations } = opts;
  if (board.length > 5) throw new Error('board cannot exceed 5 cards');
  const rng = mulberry32(opts.seed ?? randomSeed());

  const known = new Set<Card>([...hero, ...board, ...knownOpponents.flat()]);
  const pool = freshDeck().filter((c) => !known.has(c)).map((c) => CODE.get(c)!);
  const heroCodes = hero.map((c) => CODE.get(c)!);
  const boardCodes = board.map((c) => CODE.get(c)!);
  const knownOppCodes = knownOpponents.map((h) => [CODE.get(h[0])!, CODE.get(h[1])!]);

  const boardNeed = 5 - board.length;
  const draw = boardNeed + opponents * 2;
  if (draw > pool.length) throw new Error('not enough cards to simulate');

  const heroSeven = new Array<number>(7);
  heroSeven[0] = heroCodes[0];
  heroSeven[1] = heroCodes[1];
  const oppSeven = new Array<number>(7);

  let winShare = 0;
  let wins = 0;
  let ties = 0;

  for (let it = 0; it < iterations; it++) {
    // partial Fisher–Yates: uniformly draw `draw` cards from the pool
    for (let i = 0; i < draw; i++) {
      const j = i + randInt(rng, pool.length - i);
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    // complete the board into both eval buffers
    for (let k = 0; k < 5; k++) {
      const code = k < boardCodes.length ? boardCodes[k] : pool[k - boardCodes.length];
      heroSeven[2 + k] = code;
      oppSeven[2 + k] = code;
    }
    const heroVal = evaluateCardCodes(heroSeven);

    let bestOpp = Infinity;
    let countAtBest = 0;
    const evalOpp = (c1: number, c2: number) => {
      oppSeven[0] = c1;
      oppSeven[1] = c2;
      const v = evaluateCardCodes(oppSeven);
      if (v < bestOpp) {
        bestOpp = v;
        countAtBest = 1;
      } else if (v === bestOpp) {
        countAtBest++;
      }
    };
    for (let o = 0; o < opponents; o++) {
      evalOpp(pool[boardNeed + 2 * o], pool[boardNeed + 2 * o + 1]);
    }
    for (const [c1, c2] of knownOppCodes) evalOpp(c1, c2);

    if (heroVal < bestOpp) {
      wins++;
      winShare += 1;
    } else if (heroVal === bestOpp) {
      ties++;
      winShare += 1 / (countAtBest + 1);
    }
  }

  return {
    equity: winShare / iterations,
    win: wins / iterations,
    tie: ties / iterations,
    iterations,
  };
}
