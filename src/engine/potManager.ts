import type { PlayerState } from './types';

export interface BuiltPot {
  amount: number;
  /** Seat indices of non-folded players who can win this pot. */
  eligible: number[];
}

export interface PotBuildResult {
  /** Main pot first, then side pots in order. */
  pots: BuiltPot[];
  /** Excess chips of a bet nobody matched — returned, never part of a pot. */
  uncalled: { seatIndex: number; amount: number } | null;
}

type Contributor = Pick<PlayerState, 'seatIndex' | 'totalCommitted' | 'folded'>;

/**
 * Builds pots from total contributions. Slices contributions into layers at
 * each distinct commitment level; a player is eligible for a layer if they
 * committed at least up to it and haven't folded. Adjacent layers with the
 * same eligible set are merged, so a hand with no all-ins yields one pot.
 */
export function buildPots(players: Contributor[]): PotBuildResult {
  const work = players
    .filter((p) => p.totalCommitted > 0)
    .map((p) => ({ seat: p.seatIndex, folded: p.folded, amount: p.totalCommitted }));

  // Uncalled bet: exactly one player committed strictly more than everyone else.
  let uncalled: PotBuildResult['uncalled'] = null;
  if (work.length > 0) {
    const sorted = [...work].sort((a, b) => b.amount - a.amount);
    const second = sorted.length > 1 ? sorted[1].amount : 0;
    if (sorted[0].amount > second && !sorted[0].folded) {
      uncalled = { seatIndex: sorted[0].seat, amount: sorted[0].amount - second };
      sorted[0].amount = second; // shared ref with `work`
    }
  }

  const levels = [...new Set(work.map((w) => w.amount))].filter((v) => v > 0).sort((a, b) => a - b);
  const pots: BuiltPot[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const w of work) amount += Math.max(0, Math.min(w.amount, level) - prev);
    const eligible = work.filter((w) => !w.folded && w.amount >= level).map((w) => w.seat);
    if (amount > 0) {
      const last = pots[pots.length - 1];
      if (eligible.length === 0 && last) {
        // Unreachable in legal play (the top committer can't be folded);
        // defensively keep chips in the previous pot rather than losing them.
        last.amount += amount;
      } else if (last && sameSet(last.eligible, eligible)) {
        last.amount += amount;
      } else {
        pots.push({ amount, eligible });
      }
    }
    prev = level;
  }
  return { pots, uncalled };
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
