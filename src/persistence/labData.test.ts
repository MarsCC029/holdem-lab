import { describe, expect, it } from 'vitest';
import { applyAction, startHand } from '../engine/gameStateMachine';
import type { HandRecord } from '../engine/replay';
import type { PlayerAction, TableConfig } from '../engine/types';
import { createEmptyData, exportBackup, MAX_BACKUP_BYTES, MAX_SAVED_HANDS, parseBackup, prepareBackup, recordResult, validateLabData } from './labData';

const config: TableConfig = {
  smallBlind: 5, bigBlind: 10, buttonIndex: 5,
  seats: [
    { id: 'hero', name: '你', stack: 1000, isHero: true },
    { id: 'bot', name: '练习对手', stack: 1000, isHero: false, personalityId: 'shark' },
    { id: 'bot2', name: '对手二', stack: 1000, isHero: false, personalityId: 'rock' },
    { id: 'bot3', name: '对手三', stack: 1000, isHero: false, personalityId: 'maniac' },
    { id: 'bot4', name: '对手四', stack: 1000, isHero: false, personalityId: 'fish' },
    { id: 'bot5', name: '对手五', stack: 1000, isHero: false, personalityId: 'nit' },
  ],
};
function completeHand(handId = 'hand-1'): { record: HandRecord; net: number } {
  let state = startHand(config, 42, handId).state;
  const actions: PlayerAction[] = [];
  while (state.phase !== 'complete') {
    actions.push({ type: 'fold' });
    state = applyAction(state, actions[actions.length - 1]).state;
  }
  return { record: { handId, config, seed: 42, actions }, net: state.players[0].stack - 1000 };
}
describe('private local backup boundary', () => {
  it('round-trips a full saved snapshot including unfinished hand and training', () => {
    const complete = completeHand();
    const data = recordResult(createEmptyData(), complete.record, complete.net);
    data.session = { handId: 'unfinished', config, seed: 123, actions: [] };
    data.training = { 'outs-01': { attempts: 2, correct: 1, lastCorrect: true } };
    const backup = exportBackup(data);
    expect(parseBackup(backup)).toEqual(data);
  });
  it('rejects illegal actions, bad net, unknown versions, extra private fields and duplicate hands', () => {
    const complete = completeHand();
    const data = recordResult(createEmptyData(), complete.record, complete.net);
    expect(() => parseBackup('{not-json')).toThrow('JSON');
    expect(() => validateLabData({ ...data, schemaVersion: 2 })).toThrow('版本');
    expect(() => validateLabData({ ...data, deck: ['As'] })).toThrow();
    expect(() => validateLabData({ ...data, session: { ...complete.record, config: { ...config, seats: config.seats.slice(0, 2) } } })).toThrow();
    expect(() => validateLabData({ ...data, session: { ...complete.record, config: { ...config, smallBlind: 50, bigBlind: 100 } } })).toThrow();
    expect(() => validateLabData({ ...data, session: { ...complete.record, actions: [{ type: 'check' }] } })).toThrow('无法重放');
    expect(() => validateLabData({ ...data, hands: [{ ...data.hands[0], net: 99 }] })).toThrow('结算不一致');
    expect(() => validateLabData({ ...data, hands: [data.hands[0], data.hands[0]], totals: { handsPlayed: 2, netChips: -10 } })).toThrow();
  });
  it('rejects unsafe numeric parameters, malformed training and oversized backups', () => {
    const data = createEmptyData();
    for (const seed of [-1, 0x100000000, 1.5]) {
      expect(() => validateLabData({ ...data, session: { handId: 'bad', config, seed, actions: [] } })).toThrow();
    }
    expect(() => validateLabData({ ...data, totals: { handsPlayed: -1, netChips: 0 } })).toThrow();
    expect(() => validateLabData({ ...data, training: { 'outs-01': { attempts: 1, correct: 2, lastCorrect: true } } })).toThrow();
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('10 MB');
  });
  it('counts a completion once and keeps lifetime totals beyond retained history', () => {
    const first = completeHand();
    const data = recordResult(createEmptyData(), first.record, first.net);
    expect(recordResult(data, first.record, first.net)).toBe(data);
    let many = createEmptyData();
    for (let i = 0; i <= MAX_SAVED_HANDS; i++) {
      many = recordResult(many, { ...first.record, handId: `h-${i}` }, first.net);
    }
    expect(many.hands).toHaveLength(1000);
    expect(many.hands[0].record.handId).toBe('h-1');
    expect(many.totals).toEqual({ handsPlayed: 1001, netChips: first.net * 1001 });
  });
  it('revalidates changed record content instead of trusting a prior replay', () => {
    const hand = completeHand();
    const data = recordResult(createEmptyData(), hand.record, hand.net);
    validateLabData(data);
    hand.record.actions = [{ type: 'check' }];
    expect(() => validateLabData(data)).toThrow('无法重放');
  });
  it('exports compact full data when it fits and explicitly counts old hands omitted from smaller exports', () => {
    const old = completeHand('old-hand');
    const recent = completeHand('recent-hand');
    let data = recordResult(createEmptyData(), old.record, old.net);
    data = recordResult(data, recent.record, recent.net);
    data.hands[0].completedAt = 10;
    data.hands[1].completedAt = 20;
    data.session = { handId: 'unfinished', config, seed: 321, actions: [] };
    data.training = { 'outs-01': { attempts: 1, correct: 1, lastCorrect: true } };
    const full = prepareBackup(data);
    expect(full).toEqual({ json: exportBackup(data), omittedHands: 0, includedHands: 2 });
    expect(full.json).not.toContain('\n');
    const justRecent = { ...data, hands: [data.hands[1]] };
    const limit = new TextEncoder().encode(JSON.stringify(justRecent)).byteLength;
    const limited = prepareBackup(data, limit);
    expect(limited.omittedHands).toBe(1);
    expect(limited.includedHands).toBe(1);
    const restored = parseBackup(limited.json);
    expect(restored.hands.map((hand) => hand.record.handId)).toEqual(['recent-hand']);
    expect(restored.totals).toEqual(data.totals);
    expect(restored.session).toEqual(data.session);
    expect(restored.training).toEqual(data.training);
    expect(restored.settings).toEqual(data.settings);
    expect(data.hands).toHaveLength(2);
    expect(() => prepareBackup(data, 1)).toThrow('原记录未更改');
  });
});
