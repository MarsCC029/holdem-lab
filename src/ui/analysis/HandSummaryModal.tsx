import { useEffect } from 'react';
import type { Card } from '../../engine/types';
import { ladderRow } from '../../analysis/handSummary';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { tableController } from '../../game/tableController';
import { getHand } from '../../stats/db';
import { formatChips, isRedSuit, rankLabel, suitSymbol } from '../../game/format';
import { CardView } from '../table/CardView';
import './HandSummaryModal.css';

/** The classic ladder, strongest first. */
const LADDER: { name: string; cards: Card[] }[] = [
  { name: 'Royal Flush', cards: ['As', 'Ks', 'Qs', 'Js', 'Ts'] },
  { name: 'Straight Flush', cards: ['9h', '8h', '7h', '6h', '5h'] },
  { name: 'Four of a Kind', cards: ['Qc', 'Qd', 'Qh', 'Qs', '7d'] },
  { name: 'Full House', cards: ['Js', 'Jd', 'Jc', '8h', '8s'] },
  { name: 'Flush', cards: ['Ad', 'Jd', '8d', '6d', '2d'] },
  { name: 'Straight', cards: ['Tc', '9d', '8h', '7s', '6c'] },
  { name: 'Three of a Kind', cards: ['7s', '7h', '7d', 'Kc', '4s'] },
  { name: 'Two Pair', cards: ['Kh', 'Kc', '9s', '9d', '5c'] },
  { name: 'One Pair', cards: ['Ac', 'Ah', 'Jd', '6s', '3h'] },
  { name: 'High Card', cards: ['As', 'Qd', '9c', '6h', '3s'] },
];

export function HandSummaryModal() {
  const summary = useGameStore((s) => s.summary);
  const awaitingNext = useGameStore((s) => s.awaitingNext);
  const open = useUiStore((s) => s.summaryOpen);
  const setOpen = useUiStore((s) => s.setSummaryOpen);
  const openReplay = useUiStore((s) => s.openReplay);

  const handId = summary?.handId;
  useEffect(() => {
    if (handId) useUiStore.getState().setSummaryOpen(true);
  }, [handId]);

  if (!summary || !awaitingNext || !open) return null;

  const winner = summary.winners[0];
  const winnerRow = winner?.category != null ? ladderRow(winner.category, winner.isRoyal) : null;
  const heroRow = summary.heroCategory != null ? ladderRow(summary.heroCategory, summary.heroIsRoyal) : null;
  const heroIsWinner = summary.winners.some((w) => w.isHero);

  const winnersText = summary.winners
    .map((w) => `${w.isHero ? 'You' : w.name} ${w.isHero ? 'win' : 'wins'} ${formatChips(w.amount)}`)
    .join(' · ');

  return (
    <div className="overlay">
      <div className="summary-card">
        <div className="summary-header">
          <span className="summary-kicker">HAND COMPLETE</span>
          <h2 className="summary-result">
            {winnersText}
            {winner?.description ? ` with ${winner.description}` : summary.wonWithoutShowdown ? ' — no showdown' : ''}
          </h2>
          {summary.wonWithoutShowdown && (
            <p className="summary-note">
              Everyone folded, so no cards were shown — pots can be won without ever having a hand.
            </p>
          )}
          {summary.bluffShown && (
            <p className="summary-note">
              Nobody called — and the winner flipped over a <b>stone-cold bluff</b>. Every fold you
              make teaches the table something. Fold too often, and this is how they use it.
            </p>
          )}
          {summary.heroFolded && heroRow != null && (
            <p className="summary-note">
              You folded — but with the final board your cards would have made <b>{summary.heroDescription}</b>.
              {winnerRow != null && heroRow < winnerRow ? ' That would have beaten the winner. It happens — folding can still be right at the moment you decided.' : ''}
            </p>
          )}
        </div>

        <div className="summary-ladder">
          {LADDER.map((row, i) => {
            const isWinner = winnerRow === i;
            const isHero = heroRow === i;
            return (
              <div
                key={row.name}
                className={`ladder-row${isWinner ? ' ladder-row--winner' : ''}${isHero ? ' ladder-row--hero' : ''}`}
              >
                <span className="ladder-rank">{i + 1}</span>
                <span className="ladder-name">{row.name}</span>
                <span className="ladder-example">
                  {row.cards.map((c) => (
                    <span key={c} className={`ladder-card${isRedSuit(c) ? ' ladder-card--red' : ''}`}>
                      {rankLabel(c)}
                      {suitSymbol(c)}
                    </span>
                  ))}
                </span>
                <span className="ladder-marks">
                  {isWinner && (
                    <span className="ladder-mark ladder-mark--winner">
                      🏆 {winner.isHero ? 'YOU' : winner.name.split(' ')[0]} · {winner.description}
                    </span>
                  )}
                  {isHero && !(isWinner && heroIsWinner) && (
                    <span className="ladder-mark ladder-mark--hero">
                      YOU{summary.heroFolded ? ' (folded)' : ''} · {summary.heroDescription}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        <div className="summary-cards-row">
          <div className="summary-cards-group">
            <span className="drill-label">Your cards</span>
            <span className="summary-cards">
              <CardView card={summary.heroCards[0]} size="hole" dimmed={summary.heroFolded} />
              <CardView card={summary.heroCards[1]} size="hole" dimmed={summary.heroFolded} />
            </span>
          </div>
          {summary.board.length > 0 && (
            <div className="summary-cards-group">
              <span className="drill-label">Board</span>
              <span className="summary-cards">
                {summary.board.map((c) => (
                  <CardView key={c} card={c} size="hole" />
                ))}
              </span>
            </div>
          )}
        </div>

        <div className="summary-actions">
          <button
            className="summary-btn"
            onClick={() => {
              void getHand(summary.handId).then((h) => {
                if (h) openReplay(h);
              });
            }}
          >
            ▶ Replay
          </button>
          <button className="summary-btn" onClick={() => setOpen(false)}>
            Study the table
          </button>
          <button className="cta summary-next" onClick={() => tableController.continueNextHand()}>
            Deal next hand →
          </button>
        </div>
      </div>
    </div>
  );
}
