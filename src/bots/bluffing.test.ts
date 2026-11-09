import { describe, expect, it } from 'vitest';
import type { GameState, TableConfig } from '../engine/types';
import { applyAction, startHand } from '../engine/gameStateMachine';
import { mulberry32 } from '../engine/rng';
import { buildBotView, decideAction } from './botDecision';
import { postflopStrength } from './handStrength';
import { PERSONALITIES } from './personalities';

/**
 * Bluffing playtest: auto-play many hands and count postflop aggressive
 * actions (bets/raises) made with weak hands or draws. Personalities must
 * actually bluff — and at rates that match their character.
 */

const LINEUP = ['shark', 'rock', 'maniac', 'fish', 'nit', 'shark'] as const;
const HANDS = 600;

interface Aggro {
  weakBets: number; // bet/raise with hand strength < 0.35 (bluffs)
  drawBets: number; // bet/raise holding a flush draw or open-ender (semi-bluffs)
  postflopActions: number;
}

function runBluffTest(): Map<string, Aggro> {
  const rng = mulberry32(0xb10ff);
  const tallies = new Map<string, Aggro>();
  for (const pid of new Set(LINEUP)) tallies.set(pid, { weakBets: 0, drawBets: 0, postflopActions: 0 });

  for (let h = 0; h < HANDS; h++) {
    const config: TableConfig = {
      smallBlind: 5,
      bigBlind: 10,
      buttonIndex: h % LINEUP.length,
      seats: LINEUP.map((pid, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        stack: 1000,
        isHero: false,
        personalityId: pid,
      })),
    };
    let state: GameState = startHand(config, h * 104729 + 7).state;
    let steps = 0;
    while (state.phase !== 'complete') {
      if (++steps > 400) throw new Error('bluff playtest hand did not terminate');
      const seat = state.actionOn!;
      const pid = LINEUP[seat];
      const view = buildBotView(state, seat);
      const { action } = decideAction(view, PERSONALITIES[pid], 'medium', rng);
      if (state.phase !== 'preflop') {
        const t = tallies.get(pid)!;
        t.postflopActions++;
        if (action.type === 'raise') {
          const info = postflopStrength(view.holeCards, view.board);
          if (info.strength < 0.35) t.weakBets++;
          if (view.board.length < 5 && (info.flushDraw || info.straightDraw === 'oesd')) t.drawBets++;
        }
      }
      state = applyAction(state, action).state;
    }
  }
  return tallies;
}

describe(`bluffing playtest (${HANDS} hands, 6-max)`, () => {
  const stats = runBluffTest();
  const weakRate = (pid: string) => {
    const t = stats.get(pid)!;
    return t.postflopActions > 0 ? t.weakBets / t.postflopActions : 0;
  };

  it('bots actually bluff: weak-hand bets happen at the table', () => {
    expect(stats.get('maniac')!.weakBets).toBeGreaterThan(15);
    expect(stats.get('shark')!.weakBets).toBeGreaterThan(3);
  });

  it('semi-bluffs exist: draws get bet, not just called', () => {
    const total = [...stats.values()].reduce((s, t) => s + t.drawBets, 0);
    expect(total).toBeGreaterThan(10);
  });

  it('bluffing frequency matches personality', () => {
    expect(weakRate('maniac')).toBeGreaterThan(weakRate('rock') * 2);
    expect(weakRate('maniac')).toBeGreaterThan(weakRate('nit') * 2);
    expect(weakRate('maniac')).toBeGreaterThan(0.08);
  });
});
