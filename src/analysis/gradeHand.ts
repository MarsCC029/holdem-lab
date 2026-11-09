import type { Card, PlayerAction, Street } from '../engine/types';
import type { HandRecord, ReplayStep } from '../engine/replay';
import { replayHand } from '../engine/replay';
import { buildBotView, type BotView } from '../bots/botDecision';
import { handTier, handLabel } from '../bots/preflopTiers';
import { monteCarloEquity } from '../equity/monteCarlo';
import { postflopAdvice, preflopAdvice, type CoachAdvice } from '../coach/recommend';
import { pct } from '../coach/potOdds';

export type MistakeCategory =
  | 'CALL_WITHOUT_ODDS' // paid more than the hand's equity justified
  | 'LOOSE_PREFLOP' // played a hand outside the recommended range
  | 'MISSED_VALUE' // checked/called when a value bet/raise was there
  | 'UNNECESSARY_FOLD' // folded getting the right price
  | 'FOLD_WHEN_FREE' // folded when checking cost nothing
  | 'WILD_RAISE'; // raised where the coach saw a clear fold

export type Verdict = 'good' | 'minor' | 'mistake' | 'blunder';

export interface DecisionGrade {
  street: Street;
  board: Card[];
  /** What the hero actually did. */
  action: PlayerAction;
  actionText: string;
  /** What the coach recommends in that exact spot (with equity if postflop). */
  advice: CoachAdvice;
  verdict: Verdict;
  category?: MistakeCategory;
  /** Short comparative note, e.g. "You called 110 — 18% equity vs 33% needed." */
  note: string;
}

export interface HandGrade {
  handId: string;
  decisions: DecisionGrade[];
  /** e.g. "3 good decisions · 1 mistake" */
  summary: string;
  mistakes: number;
  blunders: number;
}

/** Iterations for post-hand equity — higher precision than the live coach. */
const GRADE_ITERATIONS = 10_000;

/** Grades every hero decision in a recorded hand. Pure and synchronous. */
export function gradeHand(record: HandRecord, heroSeatIndex: number): HandGrade {
  const { steps } = replayHand(record);
  return gradeHandFromSteps(record.handId, steps, heroSeatIndex);
}

export function gradeHandFromSteps(
  handId: string,
  steps: ReplayStep[],
  heroSeatIndex: number,
): HandGrade {
  const decisions: DecisionGrade[] = [];
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    if (step.seatIndex !== heroSeatIndex || !step.action) continue;
    const before = steps[i - 1].state;
    if (before.phase === 'complete') break;
    const view = buildBotView(before, heroSeatIndex);
    const advice =
      view.phase === 'preflop'
        ? preflopAdvice(view)
        : postflopAdvice(
            view,
            monteCarloEquity({
              hero: view.holeCards,
              board: view.board,
              opponents: view.numActive - 1,
              iterations: GRADE_ITERATIONS,
              seed: hashSeed(handId, i),
            }),
          );
    decisions.push(gradeDecision(view, advice, step.action));
  }
  const mistakes = decisions.filter((d) => d.verdict === 'mistake').length;
  const blunders = decisions.filter((d) => d.verdict === 'blunder').length;
  const good = decisions.filter((d) => d.verdict === 'good').length;
  const parts: string[] = [];
  if (good > 0) parts.push(`${good} good decision${good === 1 ? '' : 's'}`);
  const minor = decisions.length - good - mistakes - blunders;
  if (minor > 0) parts.push(`${minor} slightly off`);
  if (mistakes > 0) parts.push(`${mistakes} mistake${mistakes === 1 ? '' : 's'}`);
  if (blunders > 0) parts.push(`${blunders} blunder${blunders === 1 ? '' : 's'}`);
  return {
    handId,
    decisions,
    summary: parts.length > 0 ? parts.join(' · ') : 'no decisions to grade',
    mistakes,
    blunders,
  };
}

/** Pure verdict mapping — exported for direct unit testing. */
export function gradeDecision(view: BotView, advice: CoachAdvice, action: PlayerAction): DecisionGrade {
  const street = view.phase;
  const actionText = describeAction(action, view);
  const base = { street, board: view.board, action, actionText, advice };
  const equity = advice.equity;
  const required = advice.requiredEquity;

  const agrees =
    action.type === advice.action ||
    (action.type === 'check' && advice.action === 'call' && view.toCall === 0) ||
    (action.type === 'call' && advice.action === 'check' && view.toCall === 0);

  if (agrees) {
    const note =
      action.type === 'raise' && advice.raiseTo != null && action.amount != null && action.amount > advice.raiseTo * 2.5
        ? `Right idea, but ${action.amount} is much bigger than the coach's ${advice.raiseTo}.`
        : 'Matches the coach.';
    return { ...base, verdict: 'good', note };
  }

  // disagreement — classify and weigh it
  if (action.type === 'fold') {
    if (view.toCall === 0) {
      return {
        ...base,
        verdict: 'blunder',
        category: 'FOLD_WHEN_FREE',
        note: 'You folded when checking was free — never pay (or quit) when you can see a card for nothing.',
      };
    }
    const edge = equity != null && required != null ? equity - required : 0;
    return {
      ...base,
      verdict: edge > 0.15 ? 'blunder' : edge > 0.05 ? 'mistake' : 'minor',
      category: 'UNNECESSARY_FOLD',
      note:
        equity != null && required != null
          ? `You folded with ${pct(equity)} equity while only needing ${pct(required)} — that call makes money.`
          : `The coach liked ${advice.action} here.`,
    };
  }

  if ((action.type === 'call' || action.type === 'raise') && advice.action === 'fold') {
    if (street === 'preflop') {
      const tier = handTier(view.holeCards);
      return {
        ...base,
        verdict: tier >= 7 ? 'mistake' : 'minor',
        category: action.type === 'raise' ? 'WILD_RAISE' : 'LOOSE_PREFLOP',
        note: `${handLabel(view.holeCards)} is outside the recommended range here — these spots leak chips over time.`,
      };
    }
    const gap = equity != null && required != null ? required - equity : 0;
    return {
      ...base,
      verdict: gap > 0.12 ? 'blunder' : gap > 0.04 ? 'mistake' : 'minor',
      category: action.type === 'raise' ? 'WILD_RAISE' : 'CALL_WITHOUT_ODDS',
      note:
        equity != null && required != null
          ? `You put chips in with ${pct(equity)} equity needing ${pct(required)} — a losing price.`
          : `The coach saw a clear fold.`,
    };
  }

  if (advice.action === 'raise' && (action.type === 'call' || action.type === 'check')) {
    return {
      ...base,
      verdict: equity != null && equity > 0.75 ? 'mistake' : 'minor',
      category: 'MISSED_VALUE',
      note: `Strong hands want a bigger pot — ${action.type === 'check' ? 'checking' : 'just calling'} lets worse hands off cheap.`,
    };
  }

  if (action.type === 'raise' && (advice.action === 'call' || advice.action === 'check')) {
    return {
      ...base,
      verdict: 'minor',
      category: 'WILD_RAISE',
      note: 'More aggressive than needed — not terrible, but the coach preferred to keep the pot controlled.',
    };
  }

  return { ...base, verdict: 'minor', note: `The coach preferred ${advice.action}.` };
}

function describeAction(action: PlayerAction, view: BotView): string {
  switch (action.type) {
    case 'fold':
      return 'You folded';
    case 'check':
      return 'You checked';
    case 'call':
      return `You called ${view.toCall}`;
    case 'raise':
      return `You ${view.currentBet === 0 ? 'bet' : 'raised to'} ${action.amount}`;
  }
}

function hashSeed(handId: string, i: number): number {
  let h = i * 2654435761;
  for (let k = 0; k < handId.length; k++) h = (h * 31 + handId.charCodeAt(k)) | 0;
  return h >>> 0;
}
