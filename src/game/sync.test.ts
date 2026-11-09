import { describe, expect, it } from 'vitest';
import { mergeLessonResults } from './sync';
import type { LessonResult } from '../store/progressStore';

const r = (passed: boolean, score: number, at: number): LessonResult => ({
  passed,
  score,
  total: 6,
  at,
});

describe('mergeLessonResults', () => {
  it('keeps lessons that exist on only one side', () => {
    const merged = mergeLessonResults({ a: r(true, 5, 1) }, { b: r(false, 2, 2) });
    expect(Object.keys(merged).sort()).toEqual(['a', 'b']);
  });

  it('passed beats not-passed regardless of recency', () => {
    const merged = mergeLessonResults({ a: r(true, 4, 1) }, { a: r(false, 6, 99) });
    expect(merged.a.passed).toBe(true);
    expect(merged.a.score).toBe(4);
  });

  it('higher score wins among equal pass status', () => {
    const merged = mergeLessonResults({ a: r(true, 4, 99) }, { a: r(true, 6, 1) });
    expect(merged.a.score).toBe(6);
  });

  it('recency breaks full ties', () => {
    const merged = mergeLessonResults({ a: r(true, 5, 1) }, { a: r(true, 5, 2) });
    expect(merged.a.at).toBe(2);
  });

  it('is symmetric for the winning entry', () => {
    const x = { a: r(true, 5, 1) };
    const y = { a: r(false, 6, 2) };
    expect(mergeLessonResults(x, y)).toEqual(mergeLessonResults(y, x));
  });
});
