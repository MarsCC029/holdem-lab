import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { GameState, PlayerAction, TableConfig } from './types';
import { applyAction, startHand } from './gameStateMachine';
import { legalActions } from './bettingRules';
import { mulberry32, randInt, type Rng } from './rng';
import { replayHand } from './replay';

function makeConfig(stacks: number[], buttonIndex: number): TableConfig {
  return {
    smallBlind: 5,
    bigBlind: 10,
    buttonIndex,
    seats: stacks.map((stack, i) => ({ id: `p${i}`, name: `P${i}`, stack, isHero: i === 0 })),
  };
}

/** Plays a hand to completion with uniformly random legal actions. */
function playRandomHand(config: TableConfig, seed: number, rng: Rng): GameState {
  let { state } = startHand(config, seed);
  let steps = 0;
  while (state.phase !== 'complete') {
    if (++steps > 300) throw new Error('hand did not terminate within 300 actions');
    const la = legalActions(state);
    if (!la) throw new Error(`stuck: no legal actions but phase is ${state.phase}`);
    const choices: PlayerAction[] = [{ type: 'fold' }];
    if (la.check) choices.push({ type: 'check' });
    if (la.call) choices.push({ type: 'call' }, { type: 'call' }); // weight toward action
    if (la.raise) {
      choices.push({
        type: 'raise',
        amount: la.raise.minTo + randInt(rng, la.raise.maxTo - la.raise.minTo + 1),
      });
    }
    state = applyAction(state, choices[randInt(rng, choices.length)]).state;
  }
  return state;
}

const arbScenario = fc.record({
  seed: fc.integer({ min: 0, max: 0x7fffffff }),
  policySeed: fc.integer({ min: 0, max: 0x7fffffff }),
  button: fc.nat(5),
  stacks: fc.array(fc.integer({ min: 1, max: 2000 }), { minLength: 2, maxLength: 6 }),
});

describe('engine invariants (property-based)', () => {
  it('chips are conserved and every hand terminates, for arbitrary stacks and play', () => {
    fc.assert(
      fc.property(arbScenario, ({ seed, policySeed, button, stacks }) => {
        const config = makeConfig(stacks, button % stacks.length);
        const final = playRandomHand(config, seed, mulberry32(policySeed));
        const total = final.players.reduce((sum, p) => sum + p.stack, 0);
        const expected = stacks.reduce((a, b) => a + b, 0);
        expect(total).toBe(expected);
        for (const p of final.players) {
          expect(Number.isInteger(p.stack)).toBe(true);
          expect(p.stack).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('replaying {config, seed, actions} reproduces the exact final state', () => {
    fc.assert(
      fc.property(arbScenario, ({ seed, policySeed, button, stacks }) => {
        const config = makeConfig(stacks, button % stacks.length);
        const final = playRandomHand(config, seed, mulberry32(policySeed));
        const { steps } = replayHand({
          handId: final.handId,
          config,
          seed,
          actions: final.actionHistory,
        });
        const replayed = steps[steps.length - 1].state;
        expect(replayed.phase).toBe('complete');
        expect(replayed.players.map((p) => p.stack)).toEqual(final.players.map((p) => p.stack));
        expect(replayed.board).toEqual(final.board);
      }),
      { numRuns: 100 },
    );
  });
});
