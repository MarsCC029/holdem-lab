import { create } from 'zustand';
import type { StoredHand } from '../stats/db';

export type AppView = 'play' | 'lessons' | 'stats';

interface UiState {
  view: AppView;
  /** Lesson to auto-open when entering the lessons view (e.g. from a leak). */
  openLessonId: string | null;
  /** Hand currently open in the replay viewer. */
  replayHand: StoredHand | null;
  /** Whether the end-of-hand summary modal is visible. */
  summaryOpen: boolean;
  go: (view: AppView, lessonId?: string) => void;
  clearOpenLesson: () => void;
  openReplay: (hand: StoredHand) => void;
  closeReplay: () => void;
  setSummaryOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  view: 'play',
  openLessonId: null,
  replayHand: null,
  summaryOpen: false,
  go: (view, lessonId) => set({ view, openLessonId: lessonId ?? null }),
  clearOpenLesson: () => set({ openLessonId: null }),
  openReplay: (hand) => set({ replayHand: hand }),
  closeReplay: () => set({ replayHand: null }),
  setSummaryOpen: (summaryOpen) => set({ summaryOpen }),
}));
