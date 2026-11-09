export interface PotOddsInfo {
  pot: number;
  toCall: number;
  /** Minimum win probability that makes calling break-even. */
  requiredEquity: number;
  /** e.g. "3.2 : 1" */
  ratioText: string;
}

/** pot = chips already out there (including bets in front of players). */
export function potOdds(pot: number, toCall: number): PotOddsInfo {
  const requiredEquity = toCall / (pot + toCall);
  const ratio = pot / toCall;
  return {
    pot,
    toCall,
    requiredEquity,
    ratioText: `${ratio.toFixed(1)} : 1`,
  };
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
