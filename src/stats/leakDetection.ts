import type { AggregateStats } from './statsEngine';

export interface Leak {
  id: string;
  title: string;
  detail: string;
  /** Lesson that addresses this leak. */
  lessonId: string;
  severity: 'leak' | 'notice';
}

/**
 * Rule-based leak detection over aggregate stats. Every rule enforces a
 * minimum sample so a bad afternoon doesn't get labeled a personality flaw.
 */
export function detectLeaks(stats: AggregateStats): Leak[] {
  const leaks: Leak[] = [];
  const perHand = (n: number | undefined) => (stats.hands > 0 ? (n ?? 0) / stats.hands : 0);

  if (stats.hands >= 40 && stats.vpip > 0.35) {
    leaks.push({
      id: 'too-loose',
      title: 'Playing too many hands',
      detail: `You voluntarily entered ${Math.round(stats.vpip * 100)}% of pots — solid 6-max play is roughly 20–28%. Junk hands quietly bleed chips.`,
      lessonId: 'preflop-ranges',
      severity: 'leak',
    });
  }
  if (stats.hands >= 60 && stats.vpip < 0.12) {
    leaks.push({
      id: 'too-tight',
      title: 'Playing too few hands',
      detail: `You entered only ${Math.round(stats.vpip * 100)}% of pots. Folding is good — but this tight, the blinds eat you and nobody pays off your monsters.`,
      lessonId: 'preflop-ranges',
      severity: 'notice',
    });
  }
  if (stats.hands >= 40 && stats.vpip > 0.15 && stats.pfr / Math.max(stats.vpip, 0.01) < 0.35) {
    leaks.push({
      id: 'passive-preflop',
      title: 'Limping and calling too much preflop',
      detail: 'Most hands you play, you enter by calling. Raising wins the blinds, thins the field, and takes initiative — enter with a raise or not at all.',
      lessonId: 'preflop-ranges',
      severity: 'leak',
    });
  }
  if ((stats.mistakeCounts.CALL_WITHOUT_ODDS ?? 0) >= 5 && perHand(stats.mistakeCounts.CALL_WITHOUT_ODDS) > 0.06) {
    leaks.push({
      id: 'calling-station',
      title: 'Calling without the right price',
      detail: `${stats.mistakeCounts.CALL_WITHOUT_ODDS} flagged calls where your win chance didn't cover the pot odds. This is the #1 chip leak in beginner poker.`,
      lessonId: 'pot-odds',
      severity: 'leak',
    });
  }
  if ((stats.mistakeCounts.UNNECESSARY_FOLD ?? 0) >= 4) {
    leaks.push({
      id: 'overfolding',
      title: 'Folding when the price is right',
      detail: `${stats.mistakeCounts.UNNECESSARY_FOLD} folds where the pot was offering more than your hand needed. Discipline is good; leaving profit on the table isn't.`,
      lessonId: 'pot-odds',
      severity: 'leak',
    });
  }
  if ((stats.mistakeCounts.MISSED_VALUE ?? 0) >= 5) {
    leaks.push({
      id: 'missed-value',
      title: 'Missing value bets with strong hands',
      detail: `${stats.mistakeCounts.MISSED_VALUE} spots where a strong hand checked or just called. Strong hands are rare — they have to earn when they arrive.`,
      lessonId: 'cbetting',
      severity: 'leak',
    });
  }
  if ((stats.mistakeCounts.WILD_RAISE ?? 0) >= 5) {
    leaks.push({
      id: 'wild-aggression',
      title: 'Raising without a plan',
      detail: `${stats.mistakeCounts.WILD_RAISE} raises the coach read as spew. Aggression is great — aimless aggression is expensive.`,
      lessonId: 'bluffing',
      severity: 'leak',
    });
  }
  return leaks;
}
