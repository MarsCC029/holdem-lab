import { describe, expect, it } from 'vitest';
import pokersolver from 'pokersolver';
import { bluffBreakEven, callEV, completionProbability, rankSeven, requiredEquity, riverRangeEquity } from './math';
import { categories, isAnswerCorrect, rangeFixtures, trainingQuestions } from './questions';
import { isValidTrainingProgress, validateTrainingProgress } from './progress';

describe('training math and model assumptions', () => {
  it('counts exact one-card and two-card hit probabilities by enumerating draws independently', () => {
    for (const outs of [0, 4, 8, 9, 12, 15, 47]) {
      let total = 0; let hits = 0;
      for (let first = 0; first < 47; first++) {
        for (let second = first + 1; second < 47; second++) {
          total++;
          if (first < outs || second < outs) hits++;
        }
      }
      expect(completionProbability(outs, 47, 2)).toBeCloseTo(hits / total, 12);
      expect(completionProbability(outs, 47, 1)).toBeCloseTo(outs / 47, 12);
      expect(completionProbability(outs, 47, 0)).toBe(0);
    }
  });
  it('rejects impossible drawing inputs', () => {
    expect(() => completionProbability(48, 47, 1)).toThrow(RangeError);
    expect(() => completionProbability(-1, 47, 1)).toThrow(RangeError);
    expect(() => completionProbability(9, 47, 48)).toThrow(RangeError);
  });
  it('uses current pot including opponent bet and incremental call cost', () => {
    expect(requiredEquity(150, 50)).toBe(0.25);
    expect(callEV(0.3, 150, 50)).toBeCloseTo(10);
    expect(callEV(requiredEquity(150, 50), 150, 50)).toBeCloseTo(0);
    expect(bluffBreakEven(100, 50)).toBeCloseTo(1 / 3);
  });
});

describe('60 curated questions', () => {
  it('has ten unique questions in each of six categories', () => {
    expect(trainingQuestions).toHaveLength(60);
    expect(new Set(trainingQuestions.map(question => question.id)).size).toBe(60);
    for (const category of categories) expect(trainingQuestions.filter(question => question.category === category.id)).toHaveLength(10);
    for (const question of trainingQuestions) expect(Number.isFinite(question.answer), question.id).toBe(true);
  });
  it('verifies each completion-out fixture against the independent pokersolver evaluator', () => {
    const deck = '23456789TJQKA'.split('').flatMap(rank => 'shdc'.split('').map(suit => rank + suit));
    for (const question of trainingQuestions.filter(q => q.category === 'outs' && q.hero)) {
      const known = [...question.hero!, ...question.board!];
      const possible = deck.filter(card => !known.includes(card));
      const hits = possible.filter(card => {
        const name = pokersolver.Hand.solve([...known, card]).name;
        return question.id === 'outs-01' ? name.includes('Flush')
          : ['outs-05', 'outs-06'].includes(question.id) ? name.includes('Straight') || name.includes('Flush')
            : name.includes('Straight');
      });
      expect(hits.length, question.id).toBe(question.answer);
    }
  });
  it('matches independently specified numerical answers for every arithmetic fixture', () => {
    const expected: Record<string, number[]> = {
      potOdds: [20, 25, 100 / 3, 20, 20, 40, 25, 25, 20, 20],
      callEV: [12.5, -10, 50, 0, 20, -30, 30, 300, -7.5, 15],
      bluff: [20, 100 / 3, 300 / 7, 50, 60, 20, 25, 60, 100 / 3, 200 / 3],
      sizing: [60, 150, 160, 100, 220, 150, 210, 350, 175, 270],
    };
    for (const [category, answers] of Object.entries(expected)) {
      trainingQuestions.filter(q => q.category === category).forEach((question, index) => expect(question.answer, question.id).toBeCloseTo(answers[index], 10));
    }
  });
  it('uses percentage-point tolerances, exact outs/sizing and bounded chip error', () => {
    const percent = trainingQuestions.find(q => q.category === 'potOdds')!;
    expect(isAnswerCorrect(percent, percent.answer + 1)).toBe(true);
    expect(isAnswerCorrect(percent, percent.answer + 1.01)).toBe(false);
    const outs = trainingQuestions[0];
    expect(isAnswerCorrect(outs, outs.answer)).toBe(true);
    expect(isAnswerCorrect(outs, outs.answer + 0.01)).toBe(false);
    const ev = trainingQuestions.find(q => q.category === 'callEV')!;
    expect(isAnswerCorrect(ev, ev.answer - 1)).toBe(true);
    expect(isAnswerCorrect(ev, ev.answer - 1.1)).toBe(false);
    expect(isAnswerCorrect(ev, Number.NaN)).toBe(false);
    expect(isAnswerCorrect(ev, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('exact river-range oracle', () => {
  it.each(rangeFixtures.map((fixture, index) => ({ ...fixture, title: `range-${index + 1}` })))('$title matches hand-comparison explanation and independent pokersolver', fixture => {
    expect(riverRangeEquity(fixture.hero, fixture.board, fixture.range)).toBeCloseTo(fixture.expected, 12);
    const hero = pokersolver.Hand.solve([...fixture.hero, ...fixture.board]);
    let shares = 0;
    for (const holding of fixture.range) {
      const villain = pokersolver.Hand.solve([...holding, ...fixture.board]);
      const winners = pokersolver.Hand.winners([hero, villain]);
      if (winners.includes(hero)) shares += 1 / winners.length;
    }
    expect(shares / fixture.range.length).toBeCloseTo(fixture.expected, 12);
  });
  it('supports wheels, two triplets, best five and five-card ties', () => {
    expect(rankSeven(['Ah', '2h', '3h', '4h', '5h', 'Kd', 'Ks'])).toEqual([8, 5]);
    expect(rankSeven(['Kh', 'Kd', 'Kc', '9h', '9d', '9c', '2s'])).toEqual([6, 13, 9]);
    expect(rankSeven(['Ah', 'Ad', 'Kh', 'Kd', 'Qh', 'Qd', '2s'])).toEqual([2, 14, 13, 12]);
  });
  it('rejects blocked cards and malformed river fixtures', () => {
    expect(() => riverRangeEquity(['As', 'Ks'], ['Qs', 'Js', 'Ts', '2c', '3d'], [['As', 'Ad']])).toThrow(RangeError);
    expect(() => rankSeven(['As', 'As', 'Ks', 'Qs', 'Js', 'Ts', '2c'])).toThrow(RangeError);
    expect(() => riverRangeEquity(['As', 'Ks'], ['Qs', 'Js', 'Ts'], [['Ah', 'Ad']])).toThrow(RangeError);
  });
});

describe('training backup schema', () => {
  it('keeps only known question ids and consistent bounded progress', () => {
    const valid = { 'outs-01': { attempts: 3, correct: 2, lastCorrect: true }, 'potOdds-01': { attempts: 1, correct: 0, lastCorrect: false } };
    expect(isValidTrainingProgress(valid)).toBe(true);
    expect(validateTrainingProgress(valid)).toEqual(valid);
    expect(validateTrainingProgress({ ...valid, unknown: { attempts: 1, correct: 1, lastCorrect: true } })).toEqual(valid);
  });
  it.each([
    null, [], { 'outs-01': { attempts: 1, correct: 2, lastCorrect: true } },
    { 'outs-01': { attempts: -1, correct: 0, lastCorrect: false } },
    { 'outs-01': { attempts: 1, correct: 0, lastCorrect: true } },
    { 'outs-01': { attempts: 1, correct: 1, lastCorrect: false } },
    { 'outs-01': { attempts: 1, correct: 1, lastCorrect: true, deck: [] } },
  ])('rejects invalid or hidden-state-bearing progress: %j', value => {
    expect(isValidTrainingProgress(value)).toBe(false);
  });
});
