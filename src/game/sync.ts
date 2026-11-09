import type { LessonResult } from '../store/progressStore';

// Offline fork: only this pure merge utility is retained for upstream tests.
/** Best attempt wins: passed > score > recency. Pure — unit tested. */
export function mergeLessonResults(
  a: Record<string, LessonResult>,
  b: Record<string, LessonResult>,
): Record<string, LessonResult> {
  const better = (x: LessonResult, y: LessonResult): LessonResult => {
    if (x.passed !== y.passed) return x.passed ? x : y;
    if (x.score !== y.score) return x.score > y.score ? x : y;
    return x.at >= y.at ? x : y;
  };
  const out: Record<string, LessonResult> = { ...a };
  for (const [id, r] of Object.entries(b)) {
    out[id] = out[id] ? better(out[id], r) : r;
  }
  return out;
}

