import { describe, expect, it } from 'vitest';
import type { GameState, TableConfig } from '../engine/types';
import { applyAction, startHand } from '../engine/gameStateMachine';
import { mulberry32 } from '../engine/rng';
import { buildBotView, decideAction } from './botDecision';
import { PERSONALITIES } from './personalities';

/**
 * Statistical playtest: auto-play many bot-only hands and check that each
 * personality's measured preflop stats land where the design intends.
 * VPIP = % of hands where the bot voluntarily put chips in preflop
 * (blind posts and BB checks don't count). PFR = % of hands raised preflop.
 */

const LINEUP = ['shark', 'rock', 'maniac', 'fish', 'nit', 'shark'] as const;
const HANDS = 800;

interface Tally {
  dealt: number;
  vpip: number;
  pfr: number;
}

function runPlaytest(): Map<string, Tally> {
  const rng = mulberry32(0x5eed);
  const tallies = new Map<number, Tally>(LINEUP.map((_, i) => [i, { dealt: 0, vpip: 0, pfr: 0 }]));

  for (let h = 0; h < HANDS; h++) {
    const config: TableConfig = {
      smallBlind: 5,
      bigBlind: 10,
      buttonIndex: h % LINEUP.length,
      seats: LINEUP.map((pid, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        stack: 1000, // fresh stacks every hand so busts don't skew stats
        isHero: false,
        personalityId: pid,
      })),
    };
    let state: GameState = startHand(config, h * 7919 + 13).state;
    const voluntary = new Set<number>();
    const raised = new Set<number>();

    let steps = 0;
    while (state.phase !== 'complete') {
      if (++steps > 400) throw new Error('playtest hand did not terminate');
      const seat = state.actionOn!;
      const view = buildBotView(state, seat);
      const { action } = decideAction(view, PERSONALITIES[LINEUP[seat]], 'medium', rng);
      if (state.phase === 'preflop') {
        if (action.type === 'call' || action.type === 'raise') voluntary.add(seat);
        if (action.type === 'raise') raised.add(seat);
      }
      state = applyAction(state, action).state;
    }
    for (let i = 0; i < LINEUP.length; i++) {
      const t = tallies.get(i)!;
      t.dealt++;
      if (voluntary.has(i)) t.vpip++;
      if (raised.has(i)) t.pfr++;
    }
  }

  // merge the two shark seats
  const byPersonality = new Map<string, Tally>();
  for (let i = 0; i < LINEUP.length; i++) {
    const pid = LINEUP[i];
    const agg = byPersonality.get(pid) ?? { dealt: 0, vpip: 0, pfr: 0 };
    const t = tallies.get(i)!;
    agg.dealt += t.dealt;
    agg.vpip += t.vpip;
    agg.pfr += t.pfr;
    byPersonality.set(pid, agg);
  }
  return byPersonality;
}

describe('personality statistical playtest (800 hands, 6-max)', () => {
  const stats = runPlaytest();
  const vpip = (pid: string) => stats.get(pid)!.vpip / stats.get(pid)!.dealt;
  const pfr = (pid: string) => stats.get(pid)!.pfr / stats.get(pid)!.dealt;

  it('personalities are ordered loosest to tightest', () => {
    expect(vpip('maniac')).toBeGreaterThan(vpip('shark'));
    expect(vpip('fish')).toBeGreaterThan(vpip('shark'));
    expect(vpip('shark')).toBeGreaterThan(vpip('rock'));
    expect(vpip('rock')).toBeGreaterThanOrEqual(vpip('nit') - 0.02);
  });

  it('the Maniac plays loose and aggressive', () => {
    expect(vpip('maniac')).toBeGreaterThan(0.42);
    expect(pfr('maniac') / vpip('maniac')).toBeGreaterThan(0.55);
  });

  it('the Fish plays loose and passive', () => {
    expect(vpip('fish')).toBeGreaterThan(0.32);
    expect(pfr('fish')).toBeLessThan(0.14);
  });

  it('the Rock and the Nit are tight', () => {
    expect(vpip('rock')).toBeLessThan(0.22);
    expect(vpip('nit')).toBeLessThan(0.2);
  });

  it('the Shark plays a solid TAG game', () => {
    expect(vpip('shark')).toBeGreaterThan(0.18);
    expect(vpip('shark')).toBeLessThan(0.4);
    expect(pfr('shark') / vpip('shark')).toBeGreaterThan(0.45);
  });
});
