import type { Lesson } from '../types';

export const handRankings: Lesson = {
  id: 'hand-rankings',
  title: 'Hand Rankings',
  icon: '🃏',
  blurb: 'What beats what — the alphabet of poker.',
  passScore: 0.8,
  sections: [
    {
      heading: 'The ladder, from top to bottom',
      paragraphs: [
        'Every poker hand is exactly five cards. From strongest to weakest: Royal Flush, Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, One Pair, High Card.',
        'A simple way to remember the order: the rarer a hand is, the stronger it is. Five cards of one suit in a row (straight flush) almost never happens; a lonely pair happens constantly.',
        'The two most commonly confused: a FLUSH (five cards of the same suit) beats a STRAIGHT (five cards in a row). And a FULL HOUSE (three of a kind plus a pair) beats them both.',
      ],
    },
    {
      heading: 'Your best five from seven',
      paragraphs: [
        "In Hold'em you have seven cards to work with: your two private hole cards plus the five community cards. Your hand is the best five of those seven — you can use both hole cards, one, or none.",
        'Using none means "playing the board": if the five community cards are already your best hand, everyone still in the pot has at least that, and pots often split.',
        'Kickers break ties between equal hands. If two players both have a pair of kings, the highest card outside the pair decides it. K♠Q♦ beats K♥8♣ on a K-7-4-9-2 board because the queen out-kicks the eight.',
      ],
    },
    {
      heading: 'Ties and splits',
      paragraphs: [
        'Suits never break ties in poker — a heart flush is not "better" than a club flush. If two flushes compete, compare their cards from the top down.',
        'When hands are exactly equal, the pot splits evenly. This happens more than beginners expect, especially on boards that make the straight or flush for everyone.',
      ],
    },
  ],
  drills: [
    {
      kind: 'mcq',
      prompt: 'Which hand is strongest?',
      options: ['A straight', 'A flush', 'Three of a kind', 'Two pair'],
      answerIdx: 1,
      explain: 'Flush beats straight beats three of a kind beats two pair. Rarer = stronger.',
    },
    {
      kind: 'whichHandWins',
      board: ['7c', '8d', 'Ks', '2h', '9c'],
      hands: [
        { label: 'A♠ A♥', cards: ['As', 'Ah'] },
        { label: '6♠ 5♠', cards: ['6s', '5s'] },
      ],
      answerIdx: 1,
      explain: 'The 6-5 makes a 9-high straight (5-6-7-8-9) — a straight crushes a pair of aces, no matter how pretty the aces look.',
    },
    {
      kind: 'whichHandWins',
      board: ['As', 'Ks', '7s', '3d', '2c'],
      hands: [
        { label: 'Q♠ J♠', cards: ['Qs', 'Js'] },
        { label: 'A♥ K♥', cards: ['Ah', 'Kh'] },
      ],
      answerIdx: 0,
      explain: 'Top two pair is strong — but Q♠J♠ completes an ace-high spade flush. Watch three-suited boards.',
    },
    {
      kind: 'whichHandWins',
      board: ['Qh', 'Qd', '5c', '5s', '2d'],
      hands: [
        { label: 'K♠ K♥', cards: ['Ks', 'Kh'] },
        { label: 'Q♠ 7♦', cards: ['Qs', '7d'] },
      ],
      answerIdx: 1,
      explain: 'Q7 makes queens full of fives — a full house. The kings only make two pair (kings and queens). Paired boards are dangerous.',
    },
    {
      kind: 'whichHandWins',
      board: ['Ts', 'Js', 'Qs', 'Ks', 'As'],
      hands: [
        { label: '2♣ 2♦', cards: ['2c', '2d'] },
        { label: 'A♥ K♥', cards: ['Ah', 'Kh'] },
      ],
      answerIdx: -1,
      explain: 'The board itself is a royal flush — the best possible hand belongs to everyone. Both players "play the board" and split the pot.',
    },
    {
      kind: 'mcq',
      prompt: 'You hold K♠Q♦ and your opponent K♥8♣. Board: K♦ 7♠ 4♥ 9♦ 2♣. Who wins?',
      options: ['You', 'Opponent', 'Split pot'],
      answerIdx: 0,
      explain: 'Both have a pair of kings, so the kicker decides: your queen beats the eight.',
    },
  ],
};
