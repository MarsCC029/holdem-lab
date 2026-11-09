import type { Lesson } from '../types';

export const bankroll: Lesson = {
  id: 'bankroll',
  title: 'Bankroll & Tilt',
  icon: '🧘',
  blurb: 'The skills that keep good players from going broke.',
  passScore: 0.75,
  sections: [
    {
      heading: 'Variance is the entry fee',
      paragraphs: [
        'You can play a hand perfectly and lose. You can punt a stack and win. In single hands, luck dominates; over thousands of hands, skill decides everything.',
        'This is why judging yourself by RESULTS ("I lost, so I played badly") is a trap. Judge decisions: was the price right? Was the hand in range? The review after each hand exists exactly for this.',
        'Real-money rule of thumb: never sit at a cash table with more than 1/20th of your total poker money. Downswings of 20+ buy-ins happen to winning players.',
      ],
    },
    {
      heading: 'Tilt: the leak that eats all others',
      paragraphs: [
        'Tilt is playing worse because you are upset — chasing losses, calling out of frustration, raising out of boredom. Everyone tilts; winners notice it and act.',
        'The classic tilt spiral: lose a big pot with the best hand → "I deserve to win one back" → play the next junk hand → lose more. The cards owe you nothing.',
        'Practical defenses: take a break after a painful beat, decide your buy-in limits BEFORE playing, and treat every hand as a brand-new decision. Chips saved by quitting a tilted session are worth exactly as much as chips won.',
      ],
    },
  ],
  drills: [
    {
      kind: 'mcq',
      prompt: 'You got all-in with AA against KK and lost. What does this mean about your play?',
      options: [
        'You played it wrong',
        'Nothing — the decision was great, the outcome was luck',
        'You should play fewer premium hands',
        'AA is overrated',
      ],
      answerIdx: 1,
      explain: 'AA vs KK is an 82% favorite — you want that spot every single time. Losing an 82/18 happens 18% of the time. Judge the decision, not the river.',
    },
    {
      kind: 'mcq',
      prompt: 'Which of these is a symptom of tilt?',
      options: [
        'Folding junk hands in early position',
        'Calling a big river bet "because I refuse to be bluffed again"',
        'Taking a break after losing a big pot',
        'Betting a strong hand for value',
      ],
      answerIdx: 1,
      explain: 'Emotional calls to settle a score are pure tilt — the pot odds did not change because you are annoyed.',
    },
    {
      kind: 'mcq',
      prompt: 'For real-money cash games, a sensible bankroll guideline is…',
      options: [
        'Bring it all — fortune favors the brave',
        'Never risk more than ~1/20 of your poker money at one table',
        'Half your bankroll per session',
        'Bankrolls only matter for professionals',
      ],
      answerIdx: 1,
      explain: '20+ buy-ins absorbs normal variance. Playing over your bankroll turns a routine downswing into ruin — and ruined players cannot win it back.',
    },
    {
      kind: 'mcq',
      prompt: 'Over which timescale does skill dominate luck in poker?',
      options: ['One hand', 'One evening', 'Thousands of hands', 'Never — poker is pure luck'],
      answerIdx: 2,
      explain: 'Short-term results are noise. The edge from good decisions compounds over thousands of hands — which is why process beats outcome.',
    },
  ],
};
