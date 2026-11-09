import type { Card } from '../engine/types';
import type { Rng } from '../engine/rng';
import type { Personality } from '../bots/personalities';
import { postflopStrength } from '../bots/handStrength';
import { handLabel, handTier } from '../bots/preflopTiers';

/**
 * After a bot wins without showdown: does it flip over the bluff, and what
 * do we call the hand? Pure — the controller supplies the randomness.
 * Returns the hand description to show, or null to muck quietly.
 */
export function bluffRevealCheck(
  personality: Personality,
  holeCards: [Card, Card],
  board: Card[],
  rng: Rng,
): string | null {
  if (rng() > personality.showBluffChance) return null;
  const weak =
    board.length >= 3
      ? postflopStrength(holeCards, board).strength < 0.38
      : handTier(holeCards) >= 6;
  if (!weak) return null;
  return board.length >= 3 ? postflopStrength(holeCards, board).description : handLabel(holeCards);
}
