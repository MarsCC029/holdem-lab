import { cardCodes, evaluateCardCodes } from 'phe';
import type { Card } from '../engine/types';
import { freshDeck } from '../engine/deck';
import { mulberry32, randInt } from '../engine/rng';
import { handTier } from '../bots/preflopTiers';

export type RangePreset = 'tight' | 'standard' | 'loose';
export const RANGE_VERSION = 'tiers-v1';
export const RANGE_PRESETS = {
  tight: { label: '偏紧 Tight', maxTier: 3, combinations: 98 },
  standard: { label: '标准 Standard', maxTier: 5, combinations: 294 },
  loose: { label: '偏松 Loose', maxTier: 7, combinations: 666 },
} as const;

const DECK = freshDeck();
const CODES = cardCodes(DECK);
const INDEX = new Map(DECK.map((c, i) => [c, i]));
type Combo = readonly [number, number];
const COMBOS = Object.fromEntries(Object.entries(RANGE_PRESETS).map(([key, spec]) => {
  const list: Combo[] = [];
  for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) {
    if (handTier([DECK[i], DECK[j]]) <= spec.maxTier) list.push([i, j]);
  }
  return [key, list];
})) as Record<RangePreset, Combo[]>;

export function validDistinctCards(cards: readonly Card[]): boolean {
  return cards.every((c) => typeof c === 'string' && INDEX.has(c)) && new Set(cards).size === cards.length;
}

function availableCombos(preset: RangePreset, blocked: readonly Card[]): Combo[] {
  if (!Object.hasOwn(RANGE_PRESETS, preset) || !validDistinctCards(blocked)) throw new Error('无效范围或重复牌');
  const blockedIndices = new Set(blocked.map((c) => INDEX.get(c)!));
  return COMBOS[preset].filter(([a, b]) => !blockedIndices.has(a) && !blockedIndices.has(b));
}

/** Equal weight per concrete combination: a pair has six, suited four, offsuit twelve. */
export function rangeCombos(preset: RangePreset, blocked: readonly Card[] = []): [Card, Card][] {
  return availableCombos(preset, blocked).map(([a, b]) => [DECK[a], DECK[b]]);
}
export function rangeComboCount(preset: RangePreset, blocked: readonly Card[] = []): number {
  return availableCombos(preset, blocked).length;
}

export interface RangeOpponent { seatIndex: number; preset: RangePreset }
export interface RangeEquityOptions {
  hero: [Card, Card];
  board: Card[];
  opponents: RangeOpponent[];
  iterations?: number;
  seed: number;
  /** Lowering this is useful for bounded-failure tests. Cannot exceed 100 proposals per sample. */
  maxProposals?: number;
}
export interface RangeEquityResult {
  status: 'ok' | 'insufficient-samples' | 'invalid-input';
  equity: number;
  win: number;
  tie: number;
  samples: number;
  standardError: number;
  attempts: number;
  error?: string;
}
export interface RangeSample {
  heroRank: number;
  opponentRanks: ReadonlyMap<number, number>;
  heroShare: number;
}

/** Sample independent range tuples and reject the WHOLE tuple on overlap. */
export function simulateRangeEquity(
  options: RangeEquityOptions,
  onSample?: (sample: RangeSample) => void,
): RangeEquityResult {
  const empty: RangeEquityResult = { status: 'invalid-input', equity: 0, win: 0, tie: 0, samples: 0, standardError: 0, attempts: 0 };
  const { hero, board, opponents, seed } = options;
  const target = options.iterations ?? 5000;
  if (!Array.isArray(hero) || hero.length !== 2 || !Array.isArray(board) ||
      ![0, 3, 4, 5].includes(board.length) || !validDistinctCards([...hero, ...board]) ||
      !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
      !Number.isInteger(target) || target < 1 || target > 50_000 ||
      !Array.isArray(opponents) || opponents.length < 1 || opponents.length > 5 ||
      new Set(opponents.map((o) => o.seatIndex)).size !== opponents.length ||
      opponents.some((o) => !Number.isInteger(o.seatIndex) || !Object.hasOwn(RANGE_PRESETS, o.preset))) {
    return { ...empty, error: '牌、范围、座位、种子或样本参数无效' };
  }
  const blocked = [...hero, ...board];
  const lists = opponents.map((o) => availableCombos(o.preset, blocked));
  if (lists.some((list) => list.length === 0)) return { ...empty, error: '阻断牌使假设范围为空' };
  const cap = Math.min(options.maxProposals ?? target * 100, target * 100);
  if (!Number.isInteger(cap) || cap < 0) return { ...empty, error: '无效抽样上限' };
  const rng = mulberry32(seed);
  const baseBlocked = new Set(blocked.map((c) => INDEX.get(c)!));
  const heroCodes = hero.map((c) => CODES[INDEX.get(c)!]);
  const boardCodes = board.map((c) => CODES[INDEX.get(c)!]);
  let samples = 0, attempts = 0, wins = 0, ties = 0, mean = 0, m2 = 0;
  while (samples < target && attempts < cap) {
    attempts++;
    const used = new Set(baseBlocked);
    const chosen: Combo[] = [];
    let collision = false;
    for (const list of lists) {
      const combo = list[randInt(rng, list.length)];
      if (used.has(combo[0]) || used.has(combo[1])) { collision = true; break; }
      used.add(combo[0]); used.add(combo[1]); chosen.push(combo);
    }
    if (collision) continue;
    const pool = CODES.filter((_, i) => !used.has(i));
    const completeBoard = [...boardCodes];
    for (let i = 0; i < 5 - board.length; i++) {
      const j = i + randInt(rng, pool.length - i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
      completeBoard.push(pool[i]);
    }
    const heroRank = evaluateCardCodes([...heroCodes, ...completeBoard]);
    const opponentRanks = new Map<number, number>();
    let best = heroRank, winners = 1;
    for (let o = 0; o < chosen.length; o++) {
      const [a, b] = chosen[o];
      const rank = evaluateCardCodes([CODES[a], CODES[b], ...completeBoard]);
      opponentRanks.set(opponents[o].seatIndex, rank);
      if (rank < best) { best = rank; winners = 1; }
      else if (rank === best) winners++;
    }
    const share = heroRank === best ? 1 / winners : 0;
    if (share === 1) wins++;
    else if (share > 0) ties++;
    samples++;
    const delta = share - mean;
    mean += delta / samples;
    m2 += delta * (share - mean);
    onSample?.({ heroRank, opponentRanks, heroShare: share });
  }
  const sufficient = samples >= Math.min(1000, target);
  return {
    status: sufficient ? 'ok' : 'insufficient-samples',
    equity: mean, win: samples ? wins / samples : 0, tie: samples ? ties / samples : 0,
    samples, attempts, standardError: samples > 1 ? Math.sqrt(m2 / (samples - 1) / samples) : 0,
    ...(sufficient ? {} : { error: '有效样本不足；请减少对手或改用更宽的示例范围' }),
  };
}
