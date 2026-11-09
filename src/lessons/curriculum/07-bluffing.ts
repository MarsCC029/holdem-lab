import type { Lesson } from '../types';

export const bluffing: Lesson = {
  id: 'bluffing',
  title: 'Bluffing & Semi-Bluffs',
  icon: '🎭',
  blurb: 'Lie with a plan — or don\'t lie at all.',
  passScore: 0.75,
  sections: [
    {
      heading: 'Bluff with a story',
      paragraphs: [
        'A bluff works when the story you have told all hand makes sense — you raised preflop, bet the ace-high flop, and the opponent with a middle pair believes the ace hit YOU.',
        'Random bluffs ("they will fold, right?") are how beginners donate stacks. Ask first: what better hands can actually FOLD? If the answer is "none", do not bluff.',
        'Pick targets: bluff the Rock who folds everything; never bluff the Fish who calls with anything. In this game, watch how each bot reacts — it matters.',
      ],
    },
    {
      heading: 'The semi-bluff: betting with a backup plan',
      paragraphs: [
        'The best bluffs are SEMI-bluffs: you bet a draw (flush draw, open-ender) that can still become the best hand when called. Two ways to win: they fold now, or you hit later.',
        'A flush draw that bets has ~35% equity when called PLUS all the pots where the opponent just folds — that combination is often more profitable than calling.',
        'Pure bluffs with zero equity should be rare while learning. Semi-bluffs can be frequent. That single distinction keeps your aggression profitable.',
      ],
    },
  ],
  drills: [
    {
      kind: 'mcq',
      prompt: 'What makes a bet a SEMI-bluff?',
      options: [
        'Betting half your usual size',
        'Betting a hand that is behind now but can improve to the best hand',
        'Bluffing only sometimes',
        'Betting with the best hand',
      ],
      answerIdx: 1,
      explain: 'A semi-bluff wins two ways: folds now, or completing the draw later. That backup equity is what makes it powerful.',
    },
    {
      kind: 'mcq',
      prompt: 'Which opponent is the WRONG target for a bluff?',
      options: ['The Rock (folds too much)', 'The Fish (calls with anything)', 'A tight player who missed the flop'],
      answerIdx: 1,
      explain: 'You cannot bluff someone who does not fold. Against calling stations: value bet more, bluff never.',
    },
    {
      kind: 'mcq',
      prompt: 'Before bluffing, the key question to ask is…',
      options: [
        '"Do I feel lucky?"',
        '"What better hands can realistically fold?"',
        '"Have I bluffed recently?"',
        '"How big is my stack?"',
      ],
      answerIdx: 1,
      explain: 'A bluff only profits when better hands fold. If their range is all strong hands or all hands that never fold, the bluff has no job to do.',
    },
    {
      kind: 'mcq',
      prompt: 'You bet a flush draw on the flop and get called. Is that bad news?',
      options: [
        'Yes — the bluff failed',
        'No — you still have ~35% to make your flush, plus the initiative',
        'Yes — you should now go all-in to fix it',
      ],
      answerIdx: 1,
      explain: 'That is the whole point of the semi-bluff: getting called is not a disaster because your hand has real equity behind it.',
    },
  ],
};
