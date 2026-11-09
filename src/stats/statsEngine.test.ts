import { describe, expect, it } from 'vitest';
import type { StoredHand } from './db';
import type { DecisionGrade } from '../analysis/gradeHand';
import { computeStats } from './statsEngine';
import { detectLeaks } from './leakDetection';

let counter = 0;

function decision(partial: Partial<DecisionGrade>): DecisionGrade {
  return {
    street: 'preflop',
    board: [],
    action: { type: 'fold' },
    actionText: 'You folded',
    advice: { action: 'fold', headline: '', reasoning: '', handNow: '' },
    verdict: 'good',
    note: '',
    ...partial,
  };
}

function hand(net: number, decisions: DecisionGrade[]): StoredHand {
  counter++;
  return {
    handId: `h${counter}`,
    timestamp: counter,
    record: { handId: `h${counter}`, config: { smallBlind: 5, bigBlind: 10, buttonIndex: 0, seats: [] }, seed: 1, actions: [] },
    heroSeatIndex: 0,
    grade: {
      handId: `h${counter}`,
      decisions,
      summary: '',
      mistakes: decisions.filter((d) => d.verdict === 'mistake').length,
      blunders: decisions.filter((d) => d.verdict === 'blunder').length,
    },
    net,
  };
}

describe('computeStats', () => {
  it('computes VPIP, PFR, net and mistake counts from grades', () => {
    const hands: StoredHand[] = [
      hand(50, [decision({ action: { type: 'raise', amount: 30 } })]), // vpip + pfr
      hand(-20, [decision({ action: { type: 'call' } })]), // vpip only
      hand(0, [decision({ action: { type: 'fold' } })]), // neither
      hand(-30, [
        decision({ action: { type: 'call' } }),
        decision({
          street: 'river',
          action: { type: 'call' },
          verdict: 'blunder',
          category: 'CALL_WITHOUT_ODDS',
        }),
      ]),
    ];
    const s = computeStats(hands);
    expect(s.hands).toBe(4);
    expect(s.netChips).toBe(0);
    expect(s.vpip).toBeCloseTo(3 / 4);
    expect(s.pfr).toBeCloseTo(1 / 4);
    expect(s.mistakeCounts.CALL_WITHOUT_ODDS).toBe(1);
    expect(s.totalBlunders).toBe(1);
    expect(s.bankrollSeries).toEqual([50, 30, 30, 0]);
  });
});

describe('detectLeaks', () => {
  it('flags a loose-passive calling station profile', () => {
    const hands: StoredHand[] = [];
    for (let i = 0; i < 50; i++) {
      // calls preflop every hand (vpip 100%, pfr 0) and spews postflop
      hands.push(
        hand(-15, [
          decision({ action: { type: 'call' } }),
          decision({
            street: 'turn',
            action: { type: 'call' },
            verdict: 'mistake',
            category: 'CALL_WITHOUT_ODDS',
          }),
        ]),
      );
    }
    const leaks = detectLeaks(computeStats(hands));
    const ids = leaks.map((l) => l.id);
    expect(ids).toContain('too-loose');
    expect(ids).toContain('passive-preflop');
    expect(ids).toContain('calling-station');
    // every leak points at a real lesson
    for (const l of leaks) expect(l.lessonId).toBeTruthy();
  });

  it('stays quiet on small samples', () => {
    const hands: StoredHand[] = [hand(-15, [decision({ action: { type: 'call' } })])];
    expect(detectLeaks(computeStats(hands))).toEqual([]);
  });
});
