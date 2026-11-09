import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { getHand } from '../../stats/db';
import type { DecisionGrade, Verdict } from '../../analysis/gradeHand';
import { formatCards } from '../../game/format';
import './ReviewPanel.css';

const VERDICT_LABEL: Record<Verdict, string> = {
  good: 'GOOD',
  minor: 'OKAY',
  mistake: 'MISTAKE',
  blunder: 'BLUNDER',
};

export function ReviewPanel() {
  const review = useGameStore((s) => s.review);
  const status = useGameStore((s) => s.status);
  const openReplay = useUiStore((s) => s.openReplay);
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!review || status !== 'handComplete' || dismissed === review.handId) return null;

  const replay = () => {
    void getHand(review.handId).then((h) => {
      if (h) openReplay(h);
    });
  };

  return (
    <div className="review-panel">
      <div className="review-header">
        <span className="review-tag">✦ HAND REVIEW</span>
        <span className="review-summary">{review.summary}</span>
        <button className="review-replay" onClick={replay}>
          ▶ Replay
        </button>
        <button className="review-close" onClick={() => setDismissed(review.handId)} title="Dismiss">
          ×
        </button>
      </div>
      <div className="review-rows">
        {review.decisions.map((d, i) => (
          <ReviewRow key={i} decision={d} />
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ decision }: { decision: DecisionGrade }) {
  const [open, setOpen] = useState(decision.verdict === 'mistake' || decision.verdict === 'blunder');
  return (
    <div className={`review-row review-row--${decision.verdict}`} onClick={() => setOpen(!open)}>
      <div className="review-row-line">
        <span className="review-street">
          {decision.street}
          {decision.board.length > 0 ? ` · ${formatCards(decision.board)}` : ''}
        </span>
        <span className="review-action">{decision.actionText}</span>
        <span className={`review-verdict review-verdict--${decision.verdict}`}>
          {VERDICT_LABEL[decision.verdict]}
        </span>
      </div>
      {open && (
        <div className="review-detail">
          <div className="review-note">{decision.note}</div>
          {decision.verdict !== 'good' && (
            <div className="review-coach">
              Coach: <b>{decision.advice.headline}.</b> {decision.advice.reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
