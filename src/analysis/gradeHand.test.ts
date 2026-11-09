import { describe, expect, it } from 'vitest';
import type { Card, TableConfig } from '../engine/types';
import { applyAction, startHandWithDeck } from '../engine/gameStateMachine';
import { freshDeck } from '../engine/deck';
import type { ReplayStep } from '../engine/replay';
import type { BotView } from '../bots/botDecision';
import type { CoachAdvice } from '../coach/recommend';
import { gradeDecision, gradeHandFromSteps } from './gradeHand';

function view(partial: Partial<BotView>): BotView {
  return {
    seatIndex: 0,
    holeCards: ['5d', '4c'],
    board: ['Kh', 'Qh', '9c', '2s'],
    phase: 'turn',
    position: 'BB',
    pot: 300,
    toCall: 250,
    currentBet: 250,
    myStreetBet: 0,
    myStack: 800,
    bigBlind: 10,
    legal: { seatIndex: 0, fold: true, check: false, call: { amount: 250, allIn: false } },
    numActive: 2,
    ...partial,
  };
}

function advice(partial: Partial<CoachAdvice>): CoachAdvice {
  return { action: 'fold', headline: 'Fold', reasoning: 'r', handNow: 'h', ...partial };
}

describe('gradeDecision verdicts', () => {
  it('calling a big bet with almost no equity is a blunder (CALL_WITHOUT_ODDS)', () => {
    const g = gradeDecision(
      view({}),
      advice({ action: 'fold', equity: 0.08, requiredEquity: 0.45 }),
      { type: 'call' },
    );
    expect(g.verdict).toBe('blunder');
    expect(g.category).toBe('CALL_WITHOUT_ODDS');
  });

  it('folding with big equity edge is a blunder (UNNECESSARY_FOLD)', () => {
    const g = gradeDecision(
      view({}),
      advice({ action: 'call', equity: 0.55, requiredEquity: 0.2 }),
      { type: 'fold' },
    );
    expect(g.verdict).toBe('blunder');
    expect(g.category).toBe('UNNECESSARY_FOLD');
  });

  it('playing junk preflop is flagged LOOSE_PREFLOP', () => {
    const g = gradeDecision(
      view({ phase: 'preflop', holeCards: ['7h', '2c'], board: [], toCall: 30, currentBet: 40 }),
      advice({ action: 'fold' }),
      { type: 'call' },
    );
    expect(g.verdict).toBe('mistake');
    expect(g.category).toBe('LOOSE_PREFLOP');
  });

  it('checking a monster is MISSED_VALUE', () => {
    const g = gradeDecision(
      view({ toCall: 0, currentBet: 0, legal: { seatIndex: 0, fold: true, check: true, raise: { minTo: 10, maxTo: 800 } } }),
      advice({ action: 'raise', raiseTo: 180, equity: 0.9 }),
      { type: 'check' },
    );
    expect(g.verdict).toBe('mistake');
    expect(g.category).toBe('MISSED_VALUE');
  });

  it('matching the coach is good', () => {
    const g = gradeDecision(view({}), advice({ action: 'fold' }), { type: 'fold' });
    expect(g.verdict).toBe('good');
  });
});

describe('gradeHandFromSteps integration', () => {
  it('grades every hero decision in a played hand', () => {
    // hero = seat 0 (button); hero limps 72o (loose), then calls a river
    // bet with king high (bad call) — expect two flagged decisions
    const holes: [Card, Card][] = [
      ['7h', '2c'], // hero
      ['Ah', 'Kd'], // SB
      ['9s', '9c'], // BB
    ];
    const board = ['Ks', '8d', '3c', 'Jh', '4d'];
    const n = 3;
    const deal: Card[] = [];
    for (let round = 0; round < 2; round++) {
      for (let i = 1; i <= n; i++) deal.push(holes[i % n][round]);
    }
    const used = new Set([...deal, ...board]);
    const deck = [...deal, ...board, ...freshDeck().filter((c) => !used.has(c))];

    const config: TableConfig = {
      smallBlind: 5,
      bigBlind: 10,
      buttonIndex: 0,
      seats: [
        { id: 'hero', name: 'You', stack: 1000, isHero: true },
        { id: 'b1', name: 'B1', stack: 1000, isHero: false },
        { id: 'b2', name: 'B2', stack: 1000, isHero: false },
      ],
    };
    const steps: ReplayStep[] = [];
    let { state } = startHandWithDeck(config, deck, 0, 'grade-test');
    steps.push({ state, events: [] });
    const script: Array<Parameters<typeof applyAction>[1]> = [
      { type: 'call' }, // hero limps 72o (bad)
      { type: 'call' }, // SB completes
      { type: 'check' }, // BB
      // flop
      { type: 'check' }, // SB
      { type: 'check' }, // BB
      { type: 'check' }, // hero
      // turn
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      // river
      { type: 'raise', amount: 25 }, // SB bets
      { type: 'fold' }, // BB
      { type: 'call' }, // hero calls with 7-high (bad)
    ];
    for (const action of script) {
      const seatIndex = state.actionOn!;
      const r = applyAction(state, action);
      steps.push({ state: r.state, events: r.events, action, seatIndex });
      state = r.state;
    }
    expect(state.phase).toBe('complete');

    const grade = gradeHandFromSteps('grade-test', steps, 0);
    // hero decisions: preflop limp, flop check, turn check, river call
    expect(grade.decisions).toHaveLength(4);
    expect(grade.decisions[0].category).toBe('LOOSE_PREFLOP');
    const river = grade.decisions[3];
    expect(river.category).toBe('CALL_WITHOUT_ODDS');
    expect(['mistake', 'blunder']).toContain(river.verdict);
    expect(grade.summary).toMatch(/mistake|blunder/);
  });
});
