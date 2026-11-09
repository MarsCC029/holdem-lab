import type { Card, Position } from '../engine/types';

/**
 * Data-driven curriculum. Lessons are TS modules (not JSON) so drills can
 * embed real Card[] literals and get type-checked; whichHandWins drills are
 * verified against the actual evaluator by a build test, and scenario drills
 * are verified against the real coach — content cannot drift from the engine.
 */

export interface McqDrill {
  kind: 'mcq';
  prompt: string;
  options: string[];
  answerIdx: number;
  explain: string;
}

export interface WhichHandWinsDrill {
  kind: 'whichHandWins';
  prompt?: string;
  board: Card[];
  /** Two or more hole-card pairs; the winner is computed by the evaluator. */
  hands: { label: string; cards: [Card, Card] }[];
  /** Index of the winning hand — verified by lessons.test.ts. -1 = tie. */
  answerIdx: number;
  explain: string;
}

export interface ScenarioDrill {
  kind: 'scenario';
  prompt: string;
  hero: [Card, Card];
  board: Card[];
  position: Position;
  pot: number;
  toCall: number;
  options: ('fold' | 'check' | 'call' | 'raise')[];
  /** The coach-approved action — verified against coach logic in tests. */
  correctAction: 'fold' | 'check' | 'call' | 'raise';
  explain: string;
}

export type Drill = McqDrill | WhichHandWinsDrill | ScenarioDrill;

export interface LessonSection {
  heading: string;
  paragraphs: string[];
}

export interface Lesson {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  sections: LessonSection[];
  drills: Drill[];
  /** Fraction of drills that must be answered correctly to pass. */
  passScore: number;
}
