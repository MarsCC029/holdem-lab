import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Difficulty } from '../bots/personalities';

export type GameSpeed = 'slow' | 'normal' | 'fast';

interface SettingsState {
  difficulty: Difficulty;
  speed: GameSpeed;
  /** Master toggle for the live coach (Phase 3). */
  coachEnabled: boolean;
  soundEnabled: boolean;
  setDifficulty: (d: Difficulty) => void;
  setSpeed: (s: GameSpeed) => void;
  setCoachEnabled: (on: boolean) => void;
  setSoundEnabled: (on: boolean) => void;
}

export const SPEED_FACTOR: Record<GameSpeed, number> = {
  slow: 1.6,
  normal: 1,
  fast: 0.45,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      difficulty: 'medium',
      speed: 'normal',
      coachEnabled: true,
      soundEnabled: true,
      setDifficulty: (difficulty) => set({ difficulty }),
      setSpeed: (speed) => set({ speed }),
      setCoachEnabled: (coachEnabled) => set({ coachEnabled }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    { name: 'poker-mentor-settings' },
  ),
);
