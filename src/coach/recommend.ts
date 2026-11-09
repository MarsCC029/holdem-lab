import type { Position } from '../engine/types';
import type { BotView } from '../bots/botDecision';
import { handLabel, handTier } from '../bots/preflopTiers';
import { postflopStrength } from '../bots/handStrength';
import type { EquityResult } from '../equity/monteCarlo';
import { pct, potOdds } from './potOdds';

/**
 * The coach's recommended beginner chart: a solid, slightly tight 6-max game.
 * Tighter than what wins the most — but the easiest correct baseline to learn.
 */
export const OPEN_TIER_BY_POSITION: Record<Position, number> = {
  UTG: 3,
  HJ: 4,
  CO: 5,
  BTN: 6,
  SB: 5,
  BB: 6,
};
const THREEBET_TIER = 1;
const CALL_RAISE_TIER = 3;
const BB_DEFEND_TIER = 5;

export interface CoachAdvice {
  action: 'fold' | 'check' | 'call' | 'raise';
  raiseTo?: number;
  /** e.g. "Raise — T9s opens from the button" */
  headline: string;
  /** 1-2 sentence explanation of why. */
  reasoning: string;
  /** Current hand strength label ("Pair of Kings" / "AKs · tier 1"). */
  handNow: string;
  equity?: number;
  requiredEquity?: number;
  potOddsText?: string;
  /** True while equity is still being computed (panel shows a spinner). */
  pending?: boolean;
}

const POSITION_WORD: Record<Position, string> = {
  UTG: 'under the gun',
  HJ: 'the hijack',
  CO: 'the cutoff',
  BTN: 'the button',
  SB: 'the small blind',
  BB: 'the big blind',
};

/** Preflop advice is a pure chart lookup — instant, no simulation needed. */
export function preflopAdvice(view: BotView): CoachAdvice {
  const tier = handTier(view.holeCards);
  const label = handLabel(view.holeCards);
  const posWord = POSITION_WORD[view.position];
  const handNow = `${label} · tier ${tier}`;
  const facingRaise = view.currentBet > view.bigBlind;
  const odds = view.toCall > 0 ? potOdds(view.pot, view.toCall) : null;

  if (!facingRaise) {
    const openTier = OPEN_TIER_BY_POSITION[view.position];
    if (tier <= openTier && view.legal.raise) {
      const limpers = Math.max(0, Math.round(view.pot / view.bigBlind - 1.5));
      const target = Math.min((3 + limpers) * view.bigBlind, view.legal.raise.maxTo);
      return {
        action: 'raise',
        raiseTo: Math.max(target, view.legal.raise.minTo),
        headline: `Raise — ${label} plays from ${posWord}`,
        reasoning: `${label} is inside a solid opening range here. Raising builds a pot while you likely hold the best hand — and often just wins the blinds outright. Limping invites everyone in cheaply.`,
        handNow,
        requiredEquity: odds?.requiredEquity,
        potOddsText: odds?.ratioText,
      };
    }
    if (view.legal.check) {
      return {
        action: 'check',
        headline: `Check — see a free flop`,
        reasoning: `${label} isn't strong enough to raise, but nobody is making you pay. Take the free card and keep the pot small.`,
        handNow,
      };
    }
    return {
      action: 'fold',
      headline: `Fold — ${label} is below your range from ${posWord}`,
      reasoning: `A disciplined preflop game is the fastest way to stop losing chips. ${label} plays badly out of position and hits too few strong hands — wait for a better spot.`,
      handNow,
    };
  }

  // facing a raise
  if (tier <= THREEBET_TIER && view.legal.raise) {
    const target = Math.min(view.currentBet * 3, view.legal.raise.maxTo);
    return {
      action: 'raise',
      raiseTo: Math.max(target, view.legal.raise.minTo),
      headline: `Re-raise — ${label} is a premium hand`,
      reasoning: `${label} is in the top tier of starting hands. Re-raising gets more chips in while you're likely ahead and pushes out the speculative hands that want a cheap flop.`,
      handNow,
      requiredEquity: odds?.requiredEquity,
      potOddsText: odds?.ratioText,
    };
  }
  const defendTier = view.position === 'BB' ? BB_DEFEND_TIER : CALL_RAISE_TIER;
  if (tier <= defendTier) {
    return {
      action: 'call',
      headline: `Call — ${label} is worth seeing a flop`,
      reasoning: view.position === 'BB'
        ? `You already have chips in the big blind, so you're getting a discount (${odds ? odds.ratioText : 'good'} pot odds). ${label} is strong enough to defend with.`
        : `${label} can crack a raiser's big hands, and the price is reasonable. Call, then continue only if the flop actually helps you.`,
      handNow,
      requiredEquity: odds?.requiredEquity,
      potOddsText: odds?.ratioText,
    };
  }
  return {
    action: 'fold',
    headline: `Fold — ${label} can't stand a raise`,
    reasoning: `Someone has told you they have a hand. ${label} wins too rarely against a raising range to pay ${view.toCall}. Folding here is not weak — it's the play that saves you money long-term.`,
    handNow,
  };
}

/** Postflop advice: compare real equity against the price being offered. */
export function postflopAdvice(view: BotView, eq: EquityResult): CoachAdvice {
  const info = postflopStrength(view.holeCards, view.board);
  const handNow = info.description;
  const equity = eq.equity;
  const drawText =
    info.flushDraw && info.straightDraw
      ? ' plus a flush draw and a straight draw'
      : info.flushDraw
        ? ' plus a flush draw'
        : info.straightDraw === 'oesd'
          ? ' plus an open-ended straight draw'
          : info.straightDraw === 'gutshot'
            ? ' plus a gutshot straight draw'
            : '';

  if (view.toCall > 0) {
    const odds = potOdds(view.pot, view.toCall);
    const required = odds.requiredEquity;
    const base = {
      handNow,
      equity,
      requiredEquity: required,
      potOddsText: odds.ratioText,
    };
    if (equity > required + 0.25 && info.madeCategory <= 6 && view.legal.raise) {
      const target = Math.min(Math.round(view.currentBet * 2.5 / 5) * 5, view.legal.raise.maxTo);
      return {
        ...base,
        action: 'raise',
        raiseTo: Math.max(target, view.legal.raise.minTo),
        headline: `Raise — ${handNow} is way ahead`,
        reasoning: `You win about ${pct(equity)} of the time but only need ${pct(required)} to call — that's not a call, that's a value raise. Charge them while you're ahead.`,
      };
    }
    if (equity >= required) {
      return {
        ...base,
        action: 'call',
        headline: `Call — the price is right`,
        reasoning: `You have ${handNow}${drawText}, winning about ${pct(equity)} of the time, and the pot is offering ${odds.ratioText} — you only need ${pct(required)}. Calling is profitable.`,
      };
    }
    if (equity >= required - 0.04) {
      return {
        ...base,
        action: 'fold',
        headline: `Fold — a very close spot`,
        reasoning: `Your ${pct(equity)} equity is a whisker under the ${pct(required)} you need. Close calls like this are roughly break-even; while learning, take the fold and keep things simple.`,
      };
    }
    return {
      ...base,
      action: 'fold',
      headline: `Fold — you're not getting the price`,
      reasoning: `${handNow}${drawText} only wins about ${pct(equity)} of the time, but calling ${view.toCall} into ${view.pot} requires ${pct(required)}. Paying more than your hand is worth is where chips leak away.`,
    };
  }

  // no bet to face
  if (equity > 0.62 && view.legal.raise) {
    const target = Math.min(Math.round((view.myStreetBet + 0.6 * view.pot) / 5) * 5, view.legal.raise.maxTo);
    return {
      action: 'raise',
      raiseTo: Math.max(target, view.legal.raise.minTo),
      headline: `Bet — get value from ${handNow}`,
      reasoning: `With ${pct(equity)} equity you very likely have the best hand. Betting around 60% of the pot makes worse hands pay — checking lets them catch up for free.`,
      handNow,
      equity,
    };
  }
  return {
    action: 'check',
    headline: `Check — keep the pot small`,
    reasoning:
      info.flushDraw || info.straightDraw
        ? `${handNow}${drawText} isn't strong enough to bet yet, but your draw wants to see the next card as cheaply as possible. Check and take it.`
        : `${handNow} rarely gets called by worse hands, so betting mostly builds a pot you don't want. Check, and re-evaluate on the next card.`,
    handNow,
    equity,
  };
}
