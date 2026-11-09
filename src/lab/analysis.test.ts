import { describe, expect, it } from 'vitest';
import { computeDecisionAnalysis, isDecisionSnapshot } from './analysis';
import type { DecisionSnapshot } from './analysis';

function snapshot(): DecisionSnapshot {
  return { decisionId: 'hand1:action3', seed: 123, hero: ['2c', '3d'], board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    players: [{ seatIndex: 0, folded: false, totalCommitted: 50, streetBet: 0, stack: 100 },
      { seatIndex: 1, folded: false, totalCommitted: 100, streetBet: 50, stack: 50 }],
    heroSeat: 0, currentBet: 50, lastRaiseAmount: 50, bb: 10, position: 'BTN', phase: 'river',
    legal: { seatIndex: 0, fold: true, check: false, call: { amount: 50, allIn: false } },
    preset: 'standard', iterations: 1000 };
}
describe('public decision analysis', () => {
  it('uses the pot including the opponents bet, and splits ties rather than calling them wins', () => {
    const r = computeDecisionAnalysis(snapshot());
    expect(r.status).toBe('ok'); expect(r.eligiblePot).toBe(150); expect(r.toCall).toBe(50);
    expect(r.requiredEquity).toBe(0.25); expect(r.equity).toBe(0.5); expect(r.callEV).toBe(50);
    expect(r.explanation).toContain('示例假设');
    expect(r.potModel).toBe('flat');
  });
  it('does not turn ordinary pending blinds into fictional all-in side pots', () => {
    const s = snapshot(); s.hero = ['Ah', 'Ad']; s.board = []; s.phase = 'preflop';
    s.currentBet = 10; s.lastRaiseAmount = 10;
    s.legal.call = { amount: 10, allIn: false };
    s.players = [
      { seatIndex: 0, folded: false, totalCommitted: 0, streetBet: 0, stack: 1000 },
      { seatIndex: 1, folded: false, totalCommitted: 5, streetBet: 5, stack: 995 },
      { seatIndex: 2, folded: false, totalCommitted: 10, streetBet: 10, stack: 990 }];
    const r = computeDecisionAnalysis(s);
    expect(r.status).toBe('ok'); expect(r.potModel).toBe('flat'); expect(r.pendingResponses).toBe(true);
    expect(r.eligiblePot).toBe(15); expect(r.toCall).toBe(10); expect(r.requiredEquity).toBe(0.4);
    expect(r.callEV).toBeCloseTo(r.equity * 25 - 10, 10);
    expect(r.explanation).toContain('不代表全下');
  });
  it('excludes an inaccessible side pot from payout and EV', () => {
    const s = snapshot(); s.players = [
      { seatIndex: 0, folded: false, totalCommitted: 0, streetBet: 0, stack: 100 },
      { seatIndex: 1, folded: false, totalCommitted: 200, streetBet: 200, stack: 0 },
      { seatIndex: 2, folded: false, totalCommitted: 200, streetBet: 200, stack: 0 }];
    s.currentBet = 200; s.lastRaiseAmount = 200; s.legal.call = { amount: 100, allIn: true };
    const r = computeDecisionAnalysis(s);
    expect(r.equity).toBeCloseTo(1 / 3, 12); expect(r.eligiblePot).toBe(200); expect(r.callEV).toBe(0);
    expect(r.potModel).toBe('eligible-layers'); expect(r.pendingResponses).toBe(false);
  });
  it('marks mixed all-in and pending calls as provisional eligibility, not final side pots', () => {
    const s = snapshot(); s.players = [
      { seatIndex: 0, folded: false, totalCommitted: 0, streetBet: 0, stack: 100 },
      { seatIndex: 1, folded: false, totalCommitted: 5, streetBet: 5, stack: 995 },
      { seatIndex: 2, folded: false, totalCommitted: 200, streetBet: 200, stack: 0 }];
    s.currentBet = 200; s.lastRaiseAmount = 200; s.legal.call = { amount: 100, allIn: true };
    const r = computeDecisionAnalysis(s);
    expect(r.status).toBe('ok'); expect(r.potModel).toBe('eligible-layers');
    expect(r.pendingResponses).toBe(true); expect(r.requiredEquity).toBeNull();
    expect(r.explanation).toContain('并非已形成的最终边池');
  });
  it('freezes public inputs and seed for repeatable after-action explanations', () => {
    const s = snapshot(); const frozen = JSON.stringify(s);
    expect(computeDecisionAnalysis(s)).toEqual(computeDecisionAnalysis(JSON.parse(frozen)));
    expect(JSON.stringify(s)).toBe(frozen);
  });
  it('computes separate eligible layers when hero can contest both main and side pots', () => {
    const s = snapshot(); s.players = [
      { seatIndex: 0, folded: false, totalCommitted: 100, streetBet: 100, stack: 100 },
      { seatIndex: 1, folded: false, totalCommitted: 100, streetBet: 100, stack: 0 },
      { seatIndex: 2, folded: false, totalCommitted: 200, streetBet: 200, stack: 0 }];
    s.currentBet = 200; s.lastRaiseAmount = 100; s.legal.call = { amount: 100, allIn: true };
    const r = computeDecisionAnalysis(s);
    expect(r.equity).toBeCloseTo(1 / 3, 12); expect(r.eligiblePot).toBe(400);
    expect(r.callEV).toBe(100); expect(r.requiredEquity).toBeNull();
  });
  it('rejects private state/unknown fields and malformed imported snapshots', () => {
    expect(isDecisionSnapshot(snapshot())).toBe(true);
    expect(isDecisionSnapshot({ ...snapshot(), deck: ['Ah', 'Ad'] })).toBe(false);
    const s = snapshot();
    expect(isDecisionSnapshot({ ...s, players: [{ ...s.players[0], holeCards: ['Ah', 'Ad'] }, s.players[1]] })).toBe(false);
    expect(isDecisionSnapshot({ ...s, seed: -1 })).toBe(false);
    expect(isDecisionSnapshot({ ...s, iterations: null })).toBe(false);
    expect(isDecisionSnapshot({ ...s, legal: { ...s.legal, call: { ...s.legal.call, deck: ['Ah'] } } })).toBe(false);
    expect(isDecisionSnapshot({ ...s, hero: ['As', 'Ah'] })).toBe(false);
    expect(computeDecisionAnalysis({ ...s, bb: NaN }).status).toBe('invalid-input');
  });
});
