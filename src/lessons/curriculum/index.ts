import type { Lesson } from '../types';
import { handRankings } from './01-hand-rankings';
import { position } from './02-position';
import { preflopRanges } from './03-preflop-ranges';
import { potOddsLesson } from './04-pot-odds';
import { boardReading } from './05-board-reading';
import { cBetting } from './06-cbetting';
import { bluffing } from './07-bluffing';
import { bankroll } from './08-bankroll';

/** The ordered curriculum. Adding a lesson = adding a file and one line here. */
export const LESSONS: Lesson[] = [
  handRankings,
  position,
  preflopRanges,
  potOddsLesson,
  boardReading,
  cBetting,
  bluffing,
  bankroll,
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
