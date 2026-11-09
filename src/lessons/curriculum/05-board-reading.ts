import type { Lesson } from '../types';

export const boardReading: Lesson = {
  id: 'board-reading',
  title: 'Reading the Board',
  icon: '👁️',
  blurb: 'See what the community cards make possible — for everyone.',
  passScore: 0.75,
  sections: [
    {
      heading: 'Dry vs wet boards',
      paragraphs: [
        'A DRY board (K♠ 7♦ 2♣ — rainbow, unconnected) offers few draws. If you were ahead on the flop, you are probably still ahead on the turn.',
        'A WET board (J♥ T♥ 9♣ — suited, connected) is crawling with straight and flush possibilities. Big hands go down in flames here; play strong hands fast and marginal hands carefully.',
        'Before acting, ask one question every street: "What is the best hand someone could reasonably have?" — then judge how your hand compares to that, not to what you hoped to make.',
      ],
    },
    {
      heading: 'Danger patterns',
      paragraphs: [
        'Paired boards (Q-Q-5) breathe life into full houses and trips. Three of one suit means flushes are live. Four to a straight (8-9-T-J) means anyone with a queen or a seven beats your two pair.',
        'Also watch how the turn and river CHANGE things: a heart on the turn completes flush draws; a board pairing on the river can counterfeit your two small pair.',
        'Your absolute hand ("I have two pair!") matters less than your relative hand ("...on a board where every draw got there").',
      ],
    },
  ],
  drills: [
    {
      kind: 'mcq',
      prompt: 'Which flop is the "wettest" (most draw-heavy)?',
      options: ['K♠ 7♦ 2♣', 'A♣ A♦ 4♠', 'J♥ T♥ 9♣', 'K♦ K♣ K♥'],
      answerIdx: 2,
      explain: 'J♥T♥9♣ is connected AND two-suited: straight draws, flush draws, and made straights everywhere. K72 rainbow is a desert.',
    },
    {
      kind: 'whichHandWins',
      board: ['9h', '9d', '5s', '5h', 'Kd'],
      hands: [
        { label: '9♣ 8♣', cards: ['9c', '8c'] },
        { label: 'K♠ Q♠', cards: ['Ks', 'Qs'] },
      ],
      answerIdx: 0,
      explain: 'On the double-paired board the 9 makes nines full of fives. The K♠Q♠ only has kings and nines — top pair is a bluff-catcher here.',
    },
    {
      kind: 'whichHandWins',
      board: ['Ad', 'Kd', 'Qd', '2c', '3s'],
      hands: [
        { label: 'J♦ T♦', cards: ['Jd', 'Td'] },
        { label: 'A♠ A♥', cards: ['As', 'Ah'] },
      ],
      answerIdx: 0,
      explain: 'Set of aces is a monster — and it is drawing dead to the royal flush. On three-diamond broadway boards, the nuts is very nutty.',
    },
    {
      kind: 'whichHandWins',
      board: ['2s', '2h', '8c', '8d', 'Ac'],
      hands: [
        { label: '3♣ 3♦', cards: ['3c', '3d'] },
        { label: 'K♣ Q♣', cards: ['Kc', 'Qc'] },
      ],
      answerIdx: 0,
      explain: "The pocket threes make eights and threes (ace kicker); the KQ plays the board's eights and twos with the ace. The tiny pocket pair survives being 'counterfeited' — barely.",
    },
    {
      kind: 'mcq',
      prompt: 'You hold Q♠Q♥ on a board of 8♥ 9♥ T♥ — what is the right mindset?',
      options: [
        'Overpair! Bet huge, never fold',
        'Proceed with caution: flushes and straights are already possible',
        'Fold immediately',
        'Check every street no matter what',
      ],
      answerIdx: 1,
      explain: 'An overpair is still just one pair. On a three-heart, connected board, plenty of hands already beat you — value-bet smaller, and fold to serious pressure.',
    },
  ],
};
