import type { Lesson } from '../types';

export const position: Lesson = {
  id: 'position',
  title: 'Position & the Blinds',
  icon: '🧭',
  blurb: 'Why WHERE you sit matters as much as WHAT you hold.',
  passScore: 0.75,
  sections: [
    {
      heading: 'The seats at a 6-max table',
      paragraphs: [
        'Six seats, named by their relation to the dealer button: UTG (under the gun, first to act), HJ (hijack), CO (cutoff), BTN (the button), SB (small blind), and BB (big blind).',
        'The button is the best seat in poker: after the flop, you act LAST on every street. The blinds are the worst: they pay forced bets and act first after the flop.',
        'The button moves one seat clockwise every hand, so everyone takes turns in every position. Poker is fair over a full orbit — but within a hand, position is power.',
      ],
    },
    {
      heading: 'Why acting last wins money',
      paragraphs: [
        'Acting last means deciding with more information. You see whether opponents checked (often weak) or bet (often strong) before committing a single chip.',
        'With position you can value-bet thinner, bluff smarter, and take free cards when your draw misses. Out of position you are guessing first every time.',
        'Practical rule: play MORE hands in late position (CO, BTN) and FEWER in early position (UTG) and the blinds. The same mediocre hand that is a fold under the gun can be a fine raise on the button.',
      ],
    },
    {
      heading: 'Blind discipline',
      paragraphs: [
        'The blinds already have money in the pot, which makes calling look cheap — that is the trap. You will play the whole hand out of position.',
        "Defend your big blind with reasonable hands (you're getting a discount), but don't defend with junk: being priced in preflop doesn't fix being lost on the flop.",
      ],
    },
  ],
  drills: [
    {
      kind: 'mcq',
      prompt: 'Which seat acts LAST on the flop, turn, and river?',
      options: ['UTG', 'The button', 'The big blind', 'The cutoff'],
      answerIdx: 1,
      explain: 'The button always acts last postflop — that informational edge is why it wins the most money of any seat.',
    },
    {
      kind: 'mcq',
      prompt: 'Preflop, who acts FIRST in a 6-max game?',
      options: ['The small blind', 'The big blind', 'UTG', 'The button'],
      answerIdx: 2,
      explain: 'Preflop the blinds have already posted, so action starts with UTG — the seat left of the big blind.',
    },
    {
      kind: 'mcq',
      prompt: 'You hold T9s. Where is it clearly correct to open-raise it?',
      options: ['UTG', 'The button', 'Nowhere — always fold it', 'Everywhere'],
      answerIdx: 1,
      explain: 'T9 suited is a fold from UTG but a standard open from the button — same cards, different seat, different answer. That is position in one sentence.',
    },
    {
      kind: 'mcq',
      prompt: 'Why is playing out of the blinds hard even though you already have chips in?',
      options: [
        'The cards dealt to blinds are worse',
        'You must act first on every street after the flop',
        'You cannot raise from the blinds',
        'It is not hard — blinds are profitable seats',
      ],
      answerIdx: 1,
      explain: 'Blind hands play the entire hand out of position. The discount preflop rarely makes up for guessing first on three streets.',
    },
  ],
};
