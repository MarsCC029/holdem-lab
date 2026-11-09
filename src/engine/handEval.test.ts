import { describe, expect, it } from 'vitest';
import pokersolver from 'pokersolver';
import { analyzeHand, evaluate7, handCategory } from './handEval';
import { freshDeck } from './deck';
import { mulberry32, shuffleInPlace } from './rng';

const { Hand } = pokersolver;

describe('analyzeHand descriptions', () => {
  const cases: [string, string[]][] = [
    ['Royal Flush', ['As', 'Ks', 'Qs', 'Js', 'Ts', '2h', '3d']],
    ['Straight Flush, Nine high', ['9h', '8h', '7h', '6h', '5h', 'Ah', '2d']],
    ['Straight Flush, Five high', ['5h', '4h', '3h', '2h', 'Ah', 'Kd', 'Kc']],
    ['Four of a Kind, Aces', ['Ac', 'Ad', 'Ah', 'As', 'Ts', '2h', '3d']],
    ['Full House, Kings full of Nines', ['Kc', 'Kd', 'Kh', '9s', '9d', '2h', '3d']],
    // two sets of trips → higher trips full of lower trips
    ['Full House, Kings full of Nines', ['Kc', 'Kd', 'Kh', '9s', '9d', '9h', '3d']],
    ['Flush, Ace high', ['Ah', 'Kh', '9h', '5h', '2h', '3d', '3c']],
    ['Straight, Ten high', ['Th', '9c', '8d', '7s', '6h', '2h', '2d']],
    ['Straight, Five high', ['5h', '4c', '3d', '2s', 'Ah', '9h', '8d']],
    ['Three of a Kind, Sevens', ['7c', '7d', '7h', 'Ks', '2d', '3h', '9c']],
    ['Two Pair, Kings and Nines', ['Kc', 'Kd', '9h', '9s', '2d', '3h', 'Ac']],
    ['Two Pair, Kings and Nines', ['Kc', 'Kd', '9h', '9s', '2d', '2h', 'Ac']], // three pairs → best two
    ['Pair of Jacks', ['Jc', 'Jd', '9h', '7s', '2d', '3h', 'Ac']],
    ['Pair of Sixes', ['6c', '6d', '9h', '7s', '2d', '3h', 'Ac']],
    ['Ace high', ['Ac', 'Kd', '9h', '7s', '2d', '3h', '5c']],
  ];
  for (const [expected, cards] of cases) {
    it(`${cards.join(' ')} → ${expected}`, () => {
      expect(analyzeHand(cards).description).toBe(expected);
    });
  }
});

describe('analyzeHand category cross-check vs phe', () => {
  it('agrees with phe rankCards on 10,000 random 7-card hands', () => {
    const rng = mulberry32(0xc0ffee);
    const deck = freshDeck();
    for (let i = 0; i < 10_000; i++) {
      shuffleInPlace(deck, rng);
      const seven = deck.slice(0, 7);
      const analyzed = analyzeHand(seven);
      const pheCat = handCategory(seven);
      expect(
        analyzed.category,
        `mismatch on ${seven.join(' ')}: analyzer says ${analyzed.description}`,
      ).toBe(pheCat);
    }
  });
});

describe('phe winner ordering cross-check vs pokersolver', () => {
  it('agrees with pokersolver on 10,000 random 2-player showdowns', () => {
    const rng = mulberry32(0xdecade);
    const deck = freshDeck();
    for (let i = 0; i < 10_000; i++) {
      shuffleInPlace(deck, rng);
      const board = deck.slice(0, 5);
      const a = deck.slice(5, 7);
      const b = deck.slice(7, 9);
      const va = evaluate7([...a, ...board]);
      const vb = evaluate7([...b, ...board]);
      const ha = Hand.solve([...a, ...board]);
      const hb = Hand.solve([...b, ...board]);
      const winners = Hand.winners([ha, hb]);
      const label = `board ${board.join(' ')} | A ${a.join(' ')} vs B ${b.join(' ')}`;
      if (va < vb) {
        expect(winners.length, label).toBe(1);
        expect(winners[0], label).toBe(ha);
      } else if (vb < va) {
        expect(winners.length, label).toBe(1);
        expect(winners[0], label).toBe(hb);
      } else {
        expect(winners.length, label).toBe(2);
      }
    }
  });
});
