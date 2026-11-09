import type { Lesson } from '../types';

export const preflopRanges: Lesson = {
  id: 'preflop-ranges',
  title: 'Preflop Ranges',
  icon: '🎯',
  blurb: 'Which hands to play, from where — and why raising beats limping.',
  passScore: 0.75,
  sections: [
    {
      heading: 'Think in ranges, not hands',
      paragraphs: [
        'Winning players decide preflop with a simple system: from each position, play a defined set of hands (a "range") and fold everything else. No moods, no hunches.',
        'From early position play only premium hands (big pairs, AK, AQ). Each seat closer to the button adds more: suited broadways, medium pairs, then suited connectors and suited aces.',
        'Your biggest early wins come from folding: most beginners lose chips by playing far too many hands and then navigating bad spots out of position.',
      ],
    },
    {
      heading: 'Enter with a raise',
      paragraphs: [
        'When you are first into the pot, raise (about 3 big blinds) or fold. Limping (just calling the blind) invites the whole table in and tells everyone your hand is mediocre.',
        'Raising can win the blinds outright, thins the field so your good hand faces fewer lottery tickets, and puts YOU in control of the story of the hand.',
        'Facing a raise, tighten up sharply: re-raise your absolute best hands (AA, KK, QQ, AKs), call with strong-but-not-premium hands, and fold the rest without regret.',
      ],
    },
  ],
  drills: [
    {
      kind: 'scenario',
      prompt: 'You are UTG with A♠A♥. Everyone is waiting on you.',
      hero: ['As', 'Ah'],
      board: [],
      position: 'UTG',
      pot: 15,
      toCall: 10,
      options: ['fold', 'call', 'raise'],
      correctAction: 'raise',
      explain: 'The best hand in poker wants a bigger pot. Raise — limping aces to "trap" mostly traps you into a 5-way flop where anything can beat you.',
    },
    {
      kind: 'scenario',
      prompt: 'You are on the button with 7♦2♣, folded to you.',
      hero: ['7d', '2c'],
      board: [],
      position: 'BTN',
      pot: 15,
      toCall: 10,
      options: ['fold', 'call', 'raise'],
      correctAction: 'fold',
      explain: "72 offsuit is the worst hand in Hold'em — no pair, no straight, no flush potential. Even the best seat can't save it.",
    },
    {
      kind: 'scenario',
      prompt: 'The cutoff raises to 30. You are on the button with K♥9♥.',
      hero: ['Kh', '9h'],
      board: [],
      position: 'BTN',
      pot: 45,
      toCall: 30,
      options: ['fold', 'call', 'raise'],
      correctAction: 'fold',
      explain: 'K9 suited looks pretty, but against a raising range it is dominated: when a king comes, the raiser often has a better one. Fold and wait.',
    },
    {
      kind: 'mcq',
      prompt: 'You are first to enter the pot with a hand you want to play. What is the standard move?',
      options: ['Limp in cheaply', 'Raise to about 3 big blinds', 'Go all-in', 'Call and see what happens'],
      answerIdx: 1,
      explain: 'Raise or fold. A ~3BB raise wins blinds, thins the field, and takes initiative — limping does none of those.',
    },
    {
      kind: 'mcq',
      prompt: 'Which of these should you play from EVERY position?',
      options: ['Any suited hand', 'Any ace', 'Big pairs and AK', 'Any connected cards'],
      answerIdx: 2,
      explain: 'QQ+/AK are strong from anywhere. Suited junk, weak aces, and low connectors need late position (or the muck).',
    },
  ],
};
