/** Teaching calculations: inputs are public facts or explicitly supplied assumptions. */
export function completionProbability(outs: number, unseen: number, cardsToCome: number): number {
  if (!Number.isInteger(outs) || !Number.isInteger(unseen) || !Number.isInteger(cardsToCome)
    || unseen < 1 || outs < 0 || outs > unseen || cardsToCome < 0 || cardsToCome > unseen) {
    throw new RangeError('Invalid drawing probability inputs');
  }
  let miss = 1;
  for (let i = 0; i < cardsToCome; i++) miss *= Math.max(0, unseen - outs - i) / (unseen - i);
  return 1 - miss;
}

/** P includes the opponent's bet; C is the additional call, not the total street bet. */
export const requiredEquity = (potBeforeCall: number, callCost: number): number => callCost / (potBeforeCall + callCost);
export const callEV = (equity: number, potBeforeCall: number, callCost: number): number => equity * (potBeforeCall + callCost) - callCost;
export const bluffBreakEven = (potBeforeBet: number, bet: number): number => bet / (potBeforeBet + bet);

export type TrainingCard = string;
const VALUES = '23456789TJQKA';
export function cardLabel(card: TrainingCard): string {
  const suit = { s: '♠', h: '♥', d: '♦', c: '♣' }[card[1]];
  return `${card[0] === 'T' ? '10' : card[0]}${suit ?? '?'}`;
}

function rankFive(cards: TrainingCard[]): number[] {
  const values = cards.map(card => VALUES.indexOf(card[0]) + 2).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(card => card[1] === cards[0][1]);
  const unique = [...new Set(values)];
  const straight = unique.length === 5
    ? (unique[0] - unique[4] === 4 ? unique[0] : unique.join(',') === '14,5,4,3,2' ? 5 : 0) : 0;
  if (flush && straight) return [8, straight];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...values];
  if (straight) return [4, straight];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map(([v]) => v)];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]];
  if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map(([v]) => v)];
  return [0, ...values];
}

function compareRanks(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return Math.sign((a[i] ?? 0) - (b[i] ?? 0));
  }
  return 0;
}

/** Independent 21-combination oracle for fixed river training fixtures, not the game engine. */
export function rankSeven(cards: TrainingCard[]): number[] {
  if (cards.length !== 7 || new Set(cards).size !== 7 || cards.some(card => !/^[2-9TJQKA][shdc]$/.test(card))) {
    throw new RangeError('Expected seven distinct standard cards');
  }
  let best: number[] = [];
  for (let omitA = 0; omitA < 7; omitA++) {
    for (let omitB = omitA + 1; omitB < 7; omitB++) {
      const rank = rankFive(cards.filter((_, index) => index !== omitA && index !== omitB));
      if (best.length === 0 || compareRanks(rank, best) > 0) best = rank;
    }
  }
  return best;
}

export function riverRangeEquity(hero: TrainingCard[], board: TrainingCard[], range: TrainingCard[][]): number {
  if (hero.length !== 2 || board.length !== 5 || range.length === 0) throw new RangeError('Expected a river scenario');
  const heroRank = rankSeven([...hero, ...board]);
  let shares = 0;
  for (const villain of range) {
    if (villain.length !== 2 || new Set([...hero, ...board, ...villain]).size !== 9) {
      throw new RangeError('Range contains a blocked or duplicate card');
    }
    const result = compareRanks(heroRank, rankSeven([...villain, ...board]));
    shares += result > 0 ? 1 : result === 0 ? 0.5 : 0;
  }
  return shares / range.length;
}
