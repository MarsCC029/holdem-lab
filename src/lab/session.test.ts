import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/gameStateMachine';
import { replayHand } from '../engine/replay';
import type { TableConfig } from '../engine/types';
import { snapshotOf } from './useLabGame';
import { isDecisionSnapshot } from './analysis';

const config: TableConfig = { smallBlind: 5, bigBlind: 10, buttonIndex: 0,
  seats: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isHero: i === 0, stack: 1000 })) };
function heroDecision() {
  let { state } = startHand(config, 42, 'public-snapshot-test');
  for (let i = 0; i < 3; i++) state = applyAction(state, { type: 'fold' }).state;
  return state;
}
describe('table-to-analysis integration', () => {
  it('exports strictly sanitized decision information, independent from hidden cards and actual deal seed', () => {
    const state = heroDecision();
    const before = snapshotOf(state, 'standard', 2026);
    expect(isDecisionSnapshot(before)).toBe(true);
    const hiddenChanged = { ...state, seed: 999999, deck: [...state.deck].reverse(),
      players: state.players.map((p) => p.isHero ? p : { ...p, holeCards: ['As', 'Ah'] as [string, string] }) };
    expect(snapshotOf(hiddenChanged, 'standard', 2026)).toEqual(before);
    expect(before.seed).toBe(2026);
    expect(before.seed).not.toBe(state.seed);
    expect(Object.keys(before.players[1])).not.toContain('holeCards');
    expect(Object.keys(before)).not.toContain('deck');
  });
  it('takes independent public copies and reconstructs the same decision through replay', () => {
    const state = heroDecision();
    const snapshot = snapshotOf(state, 'tight', 19);
    const restored = replayHand({ handId: state.handId, seed: state.seed, config, actions: state.actionHistory }).steps.at(-1)!.state;
    expect(snapshotOf(restored, 'tight', 19)).toEqual(snapshot);
    state.players[1].stack = 1;
    expect(snapshot.players[1].stack).toBe(995);
  });
  it('refuses analysis snapshots outside the hero decision', () => {
    const { state } = startHand(config, 42, 'not-hero');
    expect(() => snapshotOf(state, 'standard', 1)).toThrow();
  });
});
