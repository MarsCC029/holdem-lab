import type { Position } from '../engine/types';

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * All bot behavior is data. Tuning a personality = editing numbers here;
 * the Phase 2 statistical playtest asserts measured VPIP/PFR match intent.
 */
export interface Personality {
  id: string;
  name: string;
  tagline: string;
  avatar: string;
  /** Plays hands of tier <= this, per position. */
  vpipTierByPosition: Record<Position, number>;
  /** Of the hands they play, fraction opened with a raise vs limped/called. */
  pfrRatio: number;
  /** Postflop bet/raise appetite multiplier (1 = balanced). */
  aggressionFactor: number;
  /** Chance to fire with air in bluffable spots. */
  bluffFrequency: number;
  /** 0..1 — tolerance for calling at bad pot odds (the Fish's defining flaw). */
  callStationFactor: number;
  /** 0..1 — how much facing a raise scares them off marginal hands. */
  foldToAggression: number;
  /** Chance to flip over a successful bluff after winning without showdown. */
  showBluffChance: number;
  /** Table talk, fired occasionally by the controller. */
  quips: {
    win: string[];
    bigWin: string[];
    allIn: string[];
    raise: string[];
    fold: string[];
    showBluff: string[];
  };
}

export const PERSONALITIES: Record<string, Personality> = {
  shark: {
    id: 'shark',
    name: 'Selena "The Shark"',
    tagline: 'Solid, balanced, and always paying attention.',
    avatar: '🦈',
    vpipTierByPosition: { UTG: 3, HJ: 4, CO: 5, BTN: 6, SB: 5, BB: 6 },
    pfrRatio: 0.75,
    aggressionFactor: 1.2,
    bluffFrequency: 0.15,
    callStationFactor: 0.05,
    foldToAggression: 0.5,
    showBluffChance: 0.12,
    quips: {
      win: ['Thank you kindly.', 'Position is profit.', 'That’s how the math works out.'],
      bigWin: ['And THAT is why you charge the draws.', 'Textbook. Frame it.'],
      allIn: ['All the chips. Your decision.', 'Time to define your hand.'],
      raise: ['Let’s raise the stakes.', 'Pressure applied.'],
      fold: ['Not my spot.', 'You can have this one.'],
      showBluff: ['You’d have called with the right price.', 'Information is expensive. That one was free.'],
    },
  },
  rock: {
    id: 'rock',
    name: 'Rocky Reyes',
    tagline: 'Folds everything. When he bets, run.',
    avatar: '🪨',
    vpipTierByPosition: { UTG: 2, HJ: 2, CO: 3, BTN: 3, SB: 3, BB: 4 },
    pfrRatio: 0.4,
    aggressionFactor: 0.7,
    bluffFrequency: 0.02,
    callStationFactor: 0,
    foldToAggression: 0.8,
    showBluffChance: 0.03,
    quips: {
      win: ['Yep.', 'Told you.'],
      bigWin: ['Patience pays.', 'Been waiting two hours for that.'],
      allIn: ['I don’t do this often.', 'You should worry now.'],
      raise: ['I have it. Fold.', 'Careful.'],
      fold: ['Nope.', 'Junk.', 'Next.'],
      showBluff: ['...felt like it.', 'Even a rock rolls once a year.'],
    },
  },
  maniac: {
    id: 'maniac',
    name: '"Mad" Marta',
    tagline: 'Raises with anything. Especially nothing.',
    avatar: '🔥',
    vpipTierByPosition: { UTG: 6, HJ: 6, CO: 7, BTN: 8, SB: 7, BB: 8 },
    pfrRatio: 0.9,
    aggressionFactor: 2.2,
    bluffFrequency: 0.35,
    callStationFactor: 0.15,
    foldToAggression: 0.15,
    showBluffChance: 0.55,
    quips: {
      win: ['HA! Ship it!', 'Too easy. TOO easy.', 'Read you like a menu.'],
      bigWin: ['STACK ME UP BABY!', 'Who else wants some?!'],
      allIn: ['ALL IN. Let’s gamble!', 'Boom. Everything. Right now.'],
      raise: ['Raise! Obviously.', 'More chips in the middle!', 'Wake up, table!'],
      fold: ['Ugh, FINE.', 'Boring hand anyway.'],
      showBluff: ['SEVEN HIGH! Read it and weep!', 'I had NOTHING. Beautiful, right?', 'You folded to AIR, friends!'],
    },
  },
  fish: {
    id: 'fish',
    name: 'Finn the Fish',
    tagline: 'Any two cards can win, right?',
    avatar: '🐟',
    vpipTierByPosition: { UTG: 6, HJ: 6, CO: 7, BTN: 7, SB: 7, BB: 8 },
    pfrRatio: 0.15,
    aggressionFactor: 0.5,
    bluffFrequency: 0.05,
    callStationFactor: 0.6,
    foldToAggression: 0.3,
    showBluffChance: 0.1,
    quips: {
      win: ['Ooh! Mine? Mine!', 'I KNEW the river would save me!', 'Lucky fins!'],
      bigWin: ['BIG bubbles! Big big bubbles!', 'See? Any two cards!'],
      allIn: ['Whee, all of them!', 'In for a splash!'],
      raise: ['Feeling splashy!', 'Why not!'],
      fold: ['Aww. Okay.', 'Fine, but I liked those.'],
      showBluff: ['Hee hee — bubbles and air!', 'I had nothing! Did I do it right?'],
    },
  },
  nit: {
    id: 'nit',
    name: 'Norm the Nit',
    tagline: 'Waiting for aces since 2019.',
    avatar: '🧊',
    vpipTierByPosition: { UTG: 2, HJ: 2, CO: 2, BTN: 3, SB: 2, BB: 3 },
    pfrRatio: 0.55,
    aggressionFactor: 0.8,
    bluffFrequency: 0.01,
    callStationFactor: 0,
    foldToAggression: 0.9,
    showBluffChance: 0.02,
    quips: {
      win: ['Finally.', 'About time.'],
      bigWin: ['Five years of folding, for this exact moment.', 'Worth the wait.'],
      allIn: ['I have aces. I’m telling you. Aces.', 'This never happens.'],
      raise: ['This is not a bluff.', 'You’ve been warned.'],
      fold: ['Obviously.', 'As always.', '*sigh*'],
      showBluff: ['I apologize. That was out of character.', 'Please don’t tell anyone.'],
    },
  },
};

/** Gaussian-ish noise amplitude applied to bot hand-strength reads. */
export const DIFFICULTY_NOISE: Record<Difficulty, number> = {
  easy: 0.15,
  medium: 0.07,
  hard: 0.03,
};
