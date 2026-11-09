import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { GameState, TableConfig } from '../engine/types';
import { applyAction, startHand, startHandWithDeck } from '../engine/gameStateMachine';
import { freshDeck } from '../engine/deck';
import { mulberry32 } from '../engine/rng';
import { buildBotView, decideAction } from './botDecision';
import { PERSONALITIES, type Difficulty } from './personalities';
import { handTier } from './preflopTiers';
import type { Card } from '../engine/types';

const personalityIds = Object.keys(PERSONALITIES);

function config(stacks: number[], buttonIndex = 0): TableConfig {
  return {
    smallBlind: 5,
    bigBlind: 10,
    buttonIndex,
    seats: stacks.map((stack, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      stack,
      isHero: false,
      personalityId: personalityIds[i % personalityIds.length],
    })),
  };
}

function riggedDeck(buttonIndex: number, holes: [Card, Card][], board: Card[]): Card[] {
  const n = holes.length;
  const deal: Card[] = [];
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= n; i++) deal.push(holes[(buttonIndex + i) % n][round]);
  }
  const used = new Set([...deal, ...board]);
  const rest = freshDeck().filter((c) => !used.has(c));
  return [...deal, ...board, ...rest];
}

describe('preflop tiers', () => {
  it('rates the classics sensibly', () => {
    expect(handTier(['As', 'Ah'])).toBe(1);
    expect(handTier(['As', 'Ks'])).toBe(1);
    expect(handTier(['As', 'Kh'])).toBe(2);
    expect(handTier(['Js', 'Jh'])).toBe(2);
    expect(handTier(['7s', '2h'])).toBe(8);
    expect(handTier(['9s', '8s'])).toBe(4);
    expect(handTier(['2s', '2h'])).toBe(5);
  });
});

describe('bot sanity', () => {
  it('the Rock folds 72o from UTG every time (100 samples)', () => {
    // 4-handed, button 0 → seat 3 is UTG and gets 7h 2c
    const deck = riggedDeck(
      0,
      [
        ['As', 'Kd'],
        ['5c', '5d'],
        ['9h', '9c'],
        ['7h', '2c'],
      ],
      ['3c', '8d', 'Jh', '4s', '9s'],
    );
    for (let i = 0; i < 100; i++) {
      const { state } = startHandWithDeck(config([1000, 1000, 1000, 1000]), deck);
      expect(state.actionOn).toBe(3); // UTG first to act
      const view = buildBotView(state, 3);
      const { action } = decideAction(view, PERSONALITIES.rock, 'hard', mulberry32(i));
      expect(action.type).toBe('fold');
    }
  });

  it('nobody ever folds aces preflop in an unraised pot (all personalities x 200 rng)', () => {
    const deck = riggedDeck(
      0,
      [
        ['Kd', 'Qc'],
        ['5c', '5d'],
        ['9h', '9c'],
        ['As', 'Ah'],
      ],
      ['3c', '8d', 'Jh', '4s', '9s'],
    );
    for (const pid of personalityIds) {
      for (let i = 0; i < 200; i++) {
        const { state } = startHandWithDeck(config([1000, 1000, 1000, 1000]), deck);
        const view = buildBotView(state, 3);
        const { action } = decideAction(view, PERSONALITIES[pid], 'medium', mulberry32(i * 7 + 1));
        expect(action.type, `${pid} folded aces (rng ${i})`).not.toBe('fold');
      }
    }
  });
});

describe('bot integration (property-based)', () => {
  it('full bot tables always play legal actions to completion with chips conserved', () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.integer({ min: 0, max: 0x7fffffff }),
          botSeed: fc.integer({ min: 0, max: 0x7fffffff }),
          button: fc.nat(5),
          difficulty: fc.constantFrom<Difficulty>('easy', 'medium', 'hard'),
          stacks: fc.array(fc.integer({ min: 1, max: 3000 }), { minLength: 2, maxLength: 6 }),
        }),
        ({ seed, botSeed, button, difficulty, stacks }) => {
          const cfg = config(stacks, button % stacks.length);
          const rng = mulberry32(botSeed);
          let state: GameState = startHand(cfg, seed).state;
          let steps = 0;
          while (state.phase !== 'complete') {
            if (++steps > 400) throw new Error('bot hand did not terminate');
            const seat = state.actionOn!;
            const personality = PERSONALITIES[cfg.seats[seat].personalityId!];
            const view = buildBotView(state, seat);
            const { action } = decideAction(view, personality, difficulty, rng);
            state = applyAction(state, action).state; // throws if illegal
          }
          const total = state.players.reduce((sum, p) => sum + p.stack, 0);
          expect(total).toBe(stacks.reduce((a, b) => a + b, 0));
        },
      ),
      { numRuns: 200 },
    );
  });
});
