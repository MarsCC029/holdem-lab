import type { StoredHand } from './db';
import type { MistakeCategory } from '../analysis/gradeHand';

export interface AggregateStats {
  hands: number;
  netChips: number;
  /** Win rate in big blinds per 100 hands (BB = 10). */
  bbPer100: number;
  /** Voluntarily put chips in preflop. */
  vpip: number;
  /** Raised preflop. */
  pfr: number;
  decisions: number;
  goodRate: number;
  totalMistakes: number;
  totalBlunders: number;
  mistakeCounts: Partial<Record<MistakeCategory, number>>;
  /** Cumulative chip net over time (chronological). */
  bankrollSeries: number[];
}

const BIG_BLIND = 10;

export function computeStats(hands: StoredHand[]): AggregateStats {
  const chrono = [...hands].sort((a, b) => a.timestamp - b.timestamp);
  let netChips = 0;
  let vpipHands = 0;
  let pfrHands = 0;
  let decisions = 0;
  let good = 0;
  let mistakes = 0;
  let blunders = 0;
  const mistakeCounts: Partial<Record<MistakeCategory, number>> = {};
  const bankrollSeries: number[] = [];

  for (const h of chrono) {
    netChips += h.net;
    bankrollSeries.push(netChips);
    let vpip = false;
    let pfr = false;
    for (const d of h.grade.decisions) {
      decisions++;
      if (d.verdict === 'good') good++;
      if (d.verdict === 'mistake') mistakes++;
      if (d.verdict === 'blunder') blunders++;
      if (d.category && d.verdict !== 'good' && d.verdict !== 'minor') {
        mistakeCounts[d.category] = (mistakeCounts[d.category] ?? 0) + 1;
      }
      if (d.street === 'preflop') {
        if (d.action.type === 'call' || d.action.type === 'raise') vpip = true;
        if (d.action.type === 'raise') pfr = true;
      }
    }
    if (vpip) vpipHands++;
    if (pfr) pfrHands++;
  }

  const n = chrono.length;
  return {
    hands: n,
    netChips,
    bbPer100: n > 0 ? (netChips / BIG_BLIND / n) * 100 : 0,
    vpip: n > 0 ? vpipHands / n : 0,
    pfr: n > 0 ? pfrHands / n : 0,
    decisions,
    goodRate: decisions > 0 ? good / decisions : 0,
    totalMistakes: mistakes,
    totalBlunders: blunders,
    mistakeCounts,
    bankrollSeries,
  };
}
