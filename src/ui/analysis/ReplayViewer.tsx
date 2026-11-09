import { useEffect, useMemo, useState } from 'react';
import type { StoredHand } from '../../stats/db';
import { replayHand, type ReplayStep } from '../../engine/replay';
import { totalPot } from '../../engine/types';
import type { DecisionGrade } from '../../analysis/gradeHand';
import { useUiStore } from '../../store/uiStore';
import { formatCards, formatChips } from '../../game/format';
import { CardView } from '../table/CardView';
import './ReplayViewer.css';

const VERDICT_LABEL: Record<DecisionGrade['verdict'], string> = {
  good: 'GOOD',
  minor: 'OKAY',
  mistake: 'MISTAKE',
  blunder: 'BLUNDER',
};

export function ReplayViewer() {
  const hand = useUiStore((s) => s.replayHand);
  const close = useUiStore((s) => s.closeReplay);
  if (!hand) return null;
  return <ReplayInner key={hand.handId} hand={hand} onClose={close} />;
}

function ReplayInner({ hand, onClose }: { hand: StoredHand; onClose: () => void }) {
  const steps = useMemo(() => replayHand(hand.record).steps, [hand]);
  const [idx, setIdx] = useState(0);

  // k-th hero action step → k-th graded decision
  const gradeByStep = useMemo(() => {
    const map = new Map<number, DecisionGrade>();
    let k = 0;
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].seatIndex === hand.heroSeatIndex && steps[i].action) {
        if (k < hand.grade.decisions.length) map.set(i, hand.grade.decisions[k]);
        k++;
      }
    }
    return map;
  }, [steps, hand]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, onClose]);

  const step = steps[idx];
  const state = step.state;
  const grade = gradeByStep.get(idx);
  const date = new Date(hand.timestamp);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="replay-card" onClick={(e) => e.stopPropagation()}>
        <div className="replay-header">
          <span className="replay-title">
            ✦ REPLAY · Hand #{hand.handId.split('-').pop()}
          </span>
          <span className="replay-meta">
            {date.toLocaleDateString()} · you {hand.net >= 0 ? 'won' : 'lost'} {formatChips(Math.abs(hand.net))}
          </span>
          <button className="review-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div className="replay-seats">
          {state.players.map((p) => {
            const acted = step.seatIndex === p.seatIndex;
            const next = state.actionOn === p.seatIndex;
            return (
              <div
                key={p.seatIndex}
                className={[
                  'replay-seat',
                  p.folded ? 'replay-seat--folded' : '',
                  acted ? 'replay-seat--acted' : '',
                  next ? 'replay-seat--next' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="replay-seat-name">
                  {p.isHero ? '🧑 ' : ''}
                  {p.name}
                  {state.buttonIndex === p.seatIndex && <span className="dealer-button">D</span>}
                </span>
                <span className="replay-seat-cards">
                  <CardView card={p.holeCards[0]} size="mini" dimmed={p.folded} />
                  <CardView card={p.holeCards[1]} size="mini" dimmed={p.folded} />
                </span>
                <span className="replay-seat-stack">{formatChips(p.stack)}</span>
                <span className="replay-seat-bet">
                  {p.streetBet > 0 ? `bet ${formatChips(p.streetBet)}` : p.allIn ? 'all-in' : ''}
                </span>
              </div>
            );
          })}
        </div>

        <div className="replay-center">
          <div className="replay-board">
            {state.board.length === 0 ? (
              <span className="replay-preflop">Preflop</span>
            ) : (
              state.board.map((c) => <CardView key={c} card={c} size="hole" />)
            )}
          </div>
          <span className="replay-pot">POT {formatChips(totalPot(state))}</span>
        </div>

        <div className="replay-action-line">{describeStep(step, steps, idx)}</div>

        {grade && (
          <div className={`replay-grade review-row--${grade.verdict}`}>
            <span className={`review-verdict review-verdict--${grade.verdict}`}>
              {VERDICT_LABEL[grade.verdict]}
            </span>
            <span className="replay-grade-note">
              {grade.note}
              {grade.verdict !== 'good' && (
                <>
                  {' '}
                  <b>Coach: {grade.advice.headline}.</b>
                </>
              )}
            </span>
          </div>
        )}

        <div className="replay-controls">
          <button className="replay-btn" onClick={() => setIdx(0)} disabled={idx === 0}>
            ⏮
          </button>
          <button className="replay-btn" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
            ◀
          </button>
          <input
            type="range"
            className="replay-slider"
            min={0}
            max={steps.length - 1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
          />
          <button
            className="replay-btn"
            onClick={() => setIdx(Math.min(steps.length - 1, idx + 1))}
            disabled={idx === steps.length - 1}
          >
            ▶
          </button>
          <button
            className="replay-btn"
            onClick={() => setIdx(steps.length - 1)}
            disabled={idx === steps.length - 1}
          >
            ⏭
          </button>
          <span className="replay-step-count">
            {idx + 1} / {steps.length}
          </span>
        </div>
      </div>
    </div>
  );
}

function describeStep(step: ReplayStep, steps: ReplayStep[], idx: number): string {
  const parts: string[] = [];
  if (idx === 0) {
    parts.push('Cards are dealt and the blinds are posted.');
  } else if (step.action && step.seatIndex != null) {
    // look at the state BEFORE the action for bet context
    const before = steps[idx - 1].state;
    const actor = before.players[step.seatIndex];
    const toCall = before.currentBet - actor.streetBet;
    switch (step.action.type) {
      case 'fold':
        parts.push(`${actor.name} folds.`);
        break;
      case 'check':
        parts.push(`${actor.name} checks.`);
        break;
      case 'call':
        parts.push(`${actor.name} calls ${formatChips(Math.min(toCall, actor.stack))}.`);
        break;
      case 'raise':
        parts.push(
          `${actor.name} ${before.currentBet === 0 ? 'bets' : 'raises to'} ${formatChips(step.action.amount ?? 0)}.`,
        );
        break;
    }
  }
  for (const e of step.events) {
    if (e.type === 'streetDealt') {
      parts.push(`${e.street[0].toUpperCase() + e.street.slice(1)}: ${formatCards(e.cards)}.`);
    }
    if (e.type === 'potAwarded') {
      for (const w of e.winners) {
        const p = step.state.players[w.seatIndex];
        parts.push(`${p.name} wins ${formatChips(w.amount)}${w.description ? ` with ${w.description}` : ''}.`);
      }
    }
    if (e.type === 'uncalledBetReturned') {
      parts.push(`Uncalled ${formatChips(e.amount)} returned to ${step.state.players[e.seatIndex].name}.`);
    }
  }
  return parts.join(' ');
}
