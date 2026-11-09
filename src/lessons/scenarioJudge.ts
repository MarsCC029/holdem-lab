import type { ScenarioDrill } from './types';
import type { BotView } from '../bots/botDecision';

/**
 * Converts a scenario drill into the coach's view format. Used by the build
 * test to verify each scenario's correctAction against the real coach — the
 * lessons and the gameplay literally share one brain.
 */
export function scenarioToView(s: ScenarioDrill): BotView {
  const phase =
    s.board.length === 0 ? 'preflop' : s.board.length === 3 ? 'flop' : s.board.length === 4 ? 'turn' : 'river';
  return {
    seatIndex: 0,
    holeCards: s.hero,
    board: s.board,
    phase,
    position: s.position,
    pot: s.pot,
    toCall: s.toCall,
    currentBet: s.toCall,
    myStreetBet: 0,
    myStack: 1000,
    bigBlind: 10,
    legal: {
      seatIndex: 0,
      fold: true,
      check: s.toCall === 0,
      ...(s.toCall > 0 ? { call: { amount: s.toCall, allIn: false } } : {}),
      raise: { minTo: Math.max(s.toCall * 2, 10), maxTo: 1000 },
    },
    numActive: 2,
  };
}
