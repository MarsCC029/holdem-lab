import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LessonResult {
  score: number;
  total: number;
  passed: boolean;
  at: number;
}

interface ProgressState {
  results: Record<string, LessonResult>;
  recordResult: (lessonId: string, score: number, total: number, passed: boolean) => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      results: {},
      recordResult: (lessonId, score, total, passed) =>
        set((s) => {
          const prev = s.results[lessonId];
          // keep the best attempt
          if (prev && prev.passed && (!passed || prev.score >= score)) return s;
          return { results: { ...s.results, [lessonId]: { score, total, passed, at: Date.now() } } };
        }),
    }),
    { name: 'poker-mentor-progress' },
  ),
);
