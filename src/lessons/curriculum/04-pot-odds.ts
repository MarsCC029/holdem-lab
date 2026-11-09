import type { Lesson } from '../types';

export const potOddsLesson: Lesson = {
  id: 'pot-odds',
  title: 'Pot Odds & Outs',
  icon: '🧮',
  blurb: 'The one piece of math that turns guessing into knowing.',
  passScore: 0.75,
  sections: [
    {
      heading: 'The price of a call',
      paragraphs: [
        'Every call is a purchase: you pay the call amount for a chance to win the pot. Pot odds tell you if the price is fair.',
        'Required win% = call ÷ (pot + call). Facing a 50 bet into a 100 pot: 50 ÷ 200 = 25%. If your hand wins more than 25% of the time, calling makes money — even though you lose most of the time!',
        'This is the deepest idea in poker: individual results do not matter. Prices do. A call that wins 30% of the time at a 25% price prints money over your lifetime.',
      ],
    },
    {
      heading: 'Counting outs',
      paragraphs: [
        'Outs are the unseen cards that turn your hand into (probably) the best hand. Flush draw: 9 outs. Open-ended straight draw: 8. Gutshot: 4. Two overcards: ~6.',
        'The rule of 4 and 2: on the flop (two cards to come) your hit chance ≈ outs × 4. On the turn (one card to come) ≈ outs × 2. A flush draw on the flop: 9 × 4 ≈ 36%.',
        'Combine the two tools: count your outs → estimate your win% → compare to the required win% from pot odds. Bigger? Call. Smaller? Fold. That is the whole recipe.',
      ],
    },
  ],
  drills: [
    {
      kind: 'mcq',
      prompt: 'The pot is 100 and your opponent bets 50. What win% do you need to call profitably?',
      options: ['50%', '33%', '25%', '10%'],
      answerIdx: 2,
      explain: 'You call 50 to win 200 (100 pot + 50 bet + your 50): 50 ÷ 200 = 25%.',
    },
    {
      kind: 'mcq',
      prompt: 'You have a flush draw on the flop (9 outs). Roughly how often do you complete it by the river?',
      options: ['~18%', '~36%', '~50%', '~9%'],
      answerIdx: 1,
      explain: 'Rule of 4 on the flop: 9 outs × 4 ≈ 36%. (The exact number is 35% — the rule is plenty close.)',
    },
    {
      kind: 'mcq',
      prompt: 'You hold an open-ended straight draw on the TURN. Your chance to hit on the river?',
      options: ['~32%', '~16%', '~8%', '~24%'],
      answerIdx: 1,
      explain: 'One card to come → rule of 2: 8 outs × 2 ≈ 16%.',
    },
    {
      kind: 'scenario',
      prompt: 'Flop: K♥ 7♥ 2♣. You hold A♥ 9♥ (nut flush draw). Pot 100, opponent bets 20.',
      hero: ['Ah', '9h'],
      board: ['Kh', '7h', '2c'],
      position: 'BTN',
      pot: 120,
      toCall: 20,
      options: ['fold', 'call', 'raise'],
      correctAction: 'call',
      explain: 'You need just 14% (20 ÷ 140) and the nut flush draw plus an overcard wins far more than that. An easy, profitable call.',
    },
    {
      kind: 'scenario',
      prompt: 'Turn: K♥ Q♥ 9♣ 2♠. You hold 5♦ 4♣ (nothing). Pot 300, opponent bets 250.',
      hero: ['5d', '4c'],
      board: ['Kh', 'Qh', '9c', '2s'],
      position: 'BB',
      pot: 550,
      toCall: 250,
      options: ['fold', 'call'],
      correctAction: 'fold',
      explain: 'You need over 30% equity and you have almost none — five-high with no draw. Every chip you put in here is set on fire.',
    },
    {
      kind: 'mcq',
      prompt: 'A profitable call still loses most of the time. True or false?',
      options: ['True', 'False'],
      answerIdx: 0,
      explain: 'True! Calling 20 to win 140 with 30% equity loses 70% of the time — and still makes money on average. Poker rewards good prices, not good feelings.',
    },
  ],
};
