import { describe, expect, it } from 'vitest';
import { LESSONS } from './curriculum';
import { evaluate7 } from '../engine/handEval';
import { monteCarloEquity } from '../equity/monteCarlo';
import { postflopAdvice, preflopAdvice } from '../coach/recommend';
import { scenarioToView } from './scenarioJudge';

/**
 * Content self-verification: lesson answers are checked against the actual
 * evaluator and the actual coach. Wrong content fails the build.
 */

describe('curriculum integrity', () => {
  it('has unique ids and valid drill shapes', () => {
    const ids = new Set(LESSONS.map((l) => l.id));
    expect(ids.size).toBe(LESSONS.length);
    for (const lesson of LESSONS) {
      expect(lesson.drills.length).toBeGreaterThan(2);
      for (const drill of lesson.drills) {
        if (drill.kind === 'mcq') {
          expect(drill.answerIdx).toBeGreaterThanOrEqual(0);
          expect(drill.answerIdx).toBeLessThan(drill.options.length);
        }
      }
    }
  });

  for (const lesson of LESSONS) {
    for (const [i, drill] of lesson.drills.entries()) {
      if (drill.kind === 'whichHandWins') {
        it(`${lesson.id} drill ${i}: whichHandWins answer matches the evaluator`, () => {
          const values = drill.hands.map((h) => evaluate7([...h.cards, ...drill.board]));
          const best = Math.min(...values);
          const winners = values
            .map((v, idx) => ({ v, idx }))
            .filter((x) => x.v === best)
            .map((x) => x.idx);
          if (winners.length > 1) {
            expect(drill.answerIdx, 'tie should be marked with answerIdx -1').toBe(-1);
          } else {
            expect(winners[0]).toBe(drill.answerIdx);
          }
        });
      }
      if (drill.kind === 'scenario') {
        it(`${lesson.id} drill ${i}: scenario answer matches the coach`, () => {
          const view = scenarioToView(drill);
          const advice =
            view.phase === 'preflop'
              ? preflopAdvice(view)
              : postflopAdvice(
                  view,
                  monteCarloEquity({
                    hero: view.holeCards,
                    board: view.board,
                    opponents: 1,
                    iterations: 20_000,
                    seed: 777,
                  }),
                );
          expect(advice.action).toBe(drill.correctAction);
        });
      }
    }
  }
});
