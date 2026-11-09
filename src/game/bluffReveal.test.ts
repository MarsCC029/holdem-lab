import { describe, expect, it } from 'vitest';
import { bluffRevealCheck } from './bluffReveal';
import { PERSONALITIES } from '../bots/personalities';

const always: () => number = () => 0; // rng that always passes the chance roll
const never: () => number = () => 0.999;

describe('bluffRevealCheck', () => {
  it('the Maniac shows a postflop bluff when the roll hits', () => {
    const desc = bluffRevealCheck(PERSONALITIES.maniac, ['7h', '2c'], ['Ks', '8d', '3c'], always);
    expect(desc).toBe('King high');
  });

  it('shows junk preflop steals by hand label', () => {
    const desc = bluffRevealCheck(PERSONALITIES.maniac, ['9h', '3c'], [], always);
    expect(desc).toBe('93o');
  });

  it('never reveals a real hand — that would be free information', () => {
    const desc = bluffRevealCheck(PERSONALITIES.maniac, ['As', 'Ah'], ['Ad', '8d', '3c'], always);
    expect(desc).toBeNull();
  });

  it('respects the personality chance roll', () => {
    const desc = bluffRevealCheck(PERSONALITIES.maniac, ['7h', '2c'], ['Ks', '8d', '3c'], never);
    expect(desc).toBeNull();
  });

  it('personality ordering: the Maniac shows off far more than the Nit', () => {
    expect(PERSONALITIES.maniac.showBluffChance).toBeGreaterThan(PERSONALITIES.nit.showBluffChance * 10);
  });
});
