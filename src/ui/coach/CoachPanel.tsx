import { useGameStore } from '../../store/gameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { pct } from '../../coach/potOdds';
import './CoachPanel.css';

export function CoachPanel() {
  const coach = useGameStore((s) => s.coach);
  const heroLegal = useGameStore((s) => s.heroLegal);
  const enabled = useSettingsStore((s) => s.coachEnabled);

  if (!enabled || !coach || !heroLegal) return null;

  return (
    <div className={`coach-panel coach-panel--${coach.pending ? 'pending' : coach.action}`}>
      <div className="coach-row">
        <span className="coach-tag">♠ COACH</span>
        {coach.handNow && <span className="coach-chip coach-chip--hand">{coach.handNow}</span>}
        {coach.equity != null && (
          <span className="coach-equity">
            <span className="coach-equity-label">win chance</span>
            <span className="coach-equity-bar">
              <span className="coach-equity-fill" style={{ width: `${Math.round(coach.equity * 100)}%` }} />
              {coach.requiredEquity != null && (
                <span
                  className="coach-equity-marker"
                  style={{ left: `${Math.round(coach.requiredEquity * 100)}%` }}
                  title={`need ${pct(coach.requiredEquity)}`}
                />
              )}
            </span>
            <span className="coach-equity-num">{pct(coach.equity)}</span>
          </span>
        )}
        {coach.potOddsText && (
          <span className="coach-chip">
            pot odds {coach.potOddsText}
            {coach.requiredEquity != null ? ` · need ${pct(coach.requiredEquity)}` : ''}
          </span>
        )}
        {!coach.pending && (
          <span className={`coach-advice coach-advice--${coach.action}`}>
            {coach.action === 'raise' && coach.raiseTo != null
              ? `${coach.headline.startsWith('Bet') ? 'BET' : 'RAISE'} ${coach.raiseTo}`
              : coach.action.toUpperCase()}
          </span>
        )}
      </div>
      <div className="coach-reasoning">
        <b>{coach.headline}.</b> {coach.reasoning}
      </div>
    </div>
  );
}
