import { questionIds } from './questions';

export type TrainingProgress = Record<string, { attempts: number; correct: number; lastCorrect: boolean }>;
export const DEFAULT_TRAINING_PROGRESS: TrainingProgress = {};

function validRecord(value: unknown): value is TrainingProgress[string] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null)
    && Object.keys(item).length === 3 && Object.keys(item).every(key => ['attempts', 'correct', 'lastCorrect'].includes(key))
    && Number.isSafeInteger(item.attempts) && Number.isSafeInteger(item.correct)
    && (item.attempts as number) >= 1 && (item.correct as number) >= 0
    && (item.correct as number) <= (item.attempts as number) && typeof item.lastCorrect === 'boolean'
    && (item.lastCorrect ? (item.correct as number) > 0 : (item.correct as number) < (item.attempts as number));
}

export function isValidTrainingProgress(value: unknown): value is TrainingProgress {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([id, item]) => questionIds.has(id) && validRecord(item));
}

export function validateTrainingProgress(value: unknown): TrainingProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, item]) => questionIds.has(id) && validRecord(item)));
}
