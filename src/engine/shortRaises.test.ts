import { describe, expect, it } from 'vitest';
import { applyAction, startHand, startHandWithDeck } from './gameStateMachine';
import { legalActions } from './bettingRules';
import { freshDeck } from './deck';
import type { GameState, TableConfig } from './types';

const config = (stacks: number[]): TableConfig => ({ smallBlind: 5, bigBlind: 10, buttonIndex: 0,
  seats: stacks.map((stack, i) => ({ id: `p${i}`, name: `P${i}`, stack, isHero: i === 3 })) });
function act(s: GameState, type: 'call' | 'raise', amount?: number): GameState {
  return applyAction(s, { type, ...(amount == null ? {} : { amount }) }).state;
}
describe('cumulative short all-ins', () => {
  it('reopens for a player facing a full cumulative increment, not a later caller', () => {
    // 5-handed preflop order: 3,4,0,1,2. Raise 30 => full increment20.
    let { state } = startHand(config([1000, 50, 1000, 1000, 35]), 42);
    state = act(state, 'raise', 30); //3
    state = act(state, 'raise', 35); //4 all-in +5
    state = act(state, 'call');      //0 called35
    state = act(state, 'raise', 50); //1 all-in +15
    state = act(state, 'call');      //2 called50
    expect(state.actionOn).toBe(3);
    expect(legalActions(state)?.raise?.minTo).toBe(70); //3 now faces20: reopened
    state = act(state, 'call');
    expect(state.actionOn).toBe(0);
    expect(legalActions(state)?.raise).toBeUndefined(); //0 faces15: not reopened
  });
  it('still does not reopen for a single short raise', () => {
    let { state } = startHand(config([1000, 35, 1000]), 1);
    state = act(state, 'raise', 30);
    state = act(state, 'raise', 35);
    state = act(state, 'call');
    expect(state.actionOn).toBe(0);
    expect(legalActions(state)?.raise).toBeUndefined();
  });
  it('rejects fractional buttons, unsafe chips, and duplicate deck cards', () => {
    expect(() => startHand({ ...config([100, 100]), buttonIndex: 0.5 }, 1)).toThrow();
    expect(() => startHand(config([Number.MAX_SAFE_INTEGER, 100]), 1)).toThrow();
    const deck = freshDeck(); deck[1] = deck[0];
    expect(() => startHandWithDeck(config([100, 100]), deck)).toThrow();
  });
  it('a short postflop opening all-in requires a full increment, not completion to a blind', () => {
    let { state } = startHand(config([1000, 1000, 15, 1000]), 1);
    state = act(state, 'call'); //3
    state = act(state, 'call'); //0
    state = act(state, 'call'); //1
    state = applyAction(state, { type: 'check' }).state; //2
    expect(state.phase).toBe('flop');
    state = applyAction(state, { type: 'check' }).state; //1 checks
    state = act(state, 'raise', 5); //2's final5: short opening all-in
    expect(legalActions(state)?.raise?.minTo).toBe(15); //3 unacted: +full10
    state = act(state, 'call'); //3
    state = act(state, 'call'); //0
    expect(state.actionOn).toBe(1);
    expect(legalActions(state)?.raise).toBeUndefined(); //checker faces less than full10
  });
});
