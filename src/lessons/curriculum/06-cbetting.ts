import type { Lesson } from '../types';

export const cBetting: Lesson = {
  id: 'cbetting',
  title: 'Betting for Value',
  icon: '💰',
  blurb: 'Strong hands want big pots — learn to build them.',
  passScore: 0.75,
  sections: [
    {
      heading: 'Why we bet',
      paragraphs: [
        'There are only two good reasons to bet: VALUE (a worse hand can call you) and BLUFF (a better hand can fold). Every bet should have one of those jobs.',
        'Beginners under-bet their strong hands. Top pair, two pair, sets — these hands want money in the pot while worse hands are still willing to pay.',
        'A good default size is 50–75% of the pot: big enough to charge draws and build the pot, small enough that worse hands still call.',
      ],
    },
    {
      heading: 'The continuation bet',
      paragraphs: [
        'When you raised preflop and the flop checks to you, a bet (the "c-bet") often takes the pot immediately — your raise told a story of strength and the flop usually misses everyone.',
        'C-bet more on dry boards that favor your raising range (A-7-2, K-8-3) and less on wet boards that smash the caller\'s range (8-9-T two-tone).',
        'The flip side: checking is not surrender. Medium-strength hands often prefer to check, control the pot, and get to showdown cheaply.',
      ],
    },
  ],
  drills: [
    {
      kind: 'scenario',
      prompt: 'You raised preflop with K♥K♦ and the flop is K♠ 7♥ 2♣. Your opponent checks. Pot 60.',
      hero: ['Kh', 'Kd'],
      board: ['Ks', '7h', '2c'],
      position: 'BTN',
      pot: 60,
      toCall: 0,
      options: ['check', 'raise'],
      correctAction: 'raise',
      explain: 'Top set on a dry board — the best possible hand. Bet! Slow-playing wins you a small pot; betting starts building a big one while worse hands call.',
    },
    {
      kind: 'mcq',
      prompt: 'Which is a VALUE bet?',
      options: [
        'Betting 7-high to make a better hand fold',
        'Betting two pair so a worse top pair calls',
        'Betting nothing and hoping',
        'Checking the nuts',
      ],
      answerIdx: 1,
      explain: 'Value = a worse hand pays you. Betting two pair for top pair to call is the definition.',
    },
    {
      kind: 'mcq',
      prompt: 'A good default value-bet size is…',
      options: ['5% of the pot', '50–75% of the pot', '4x the pot', 'Always all-in'],
      answerIdx: 1,
      explain: 'Half to three-quarters pot charges draws real money and keeps worse hands in. Tiny bets give free cards; giant bets fold out everything you beat.',
    },
    {
      kind: 'mcq',
      prompt: 'You raised preflop with A♣K♣, the flop comes Q♠ 7♦ 2♥ and it checks to you. Good spot to c-bet?',
      options: ['Yes — dry board, your range hits it, and you can win now', 'No — never bet without a pair'],
      answerIdx: 0,
      explain: 'Classic c-bet: the dry queen-high board favors the preflop raiser, and your two overcards have real equity even when called.',
    },
  ],
};
