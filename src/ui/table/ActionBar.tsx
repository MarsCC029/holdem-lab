import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { tableController } from '../../game/tableController';
import { formatChips } from '../../game/format';
import './ActionBar.css';

export function ActionBar() {
  const heroLegal = useGameStore((s) => s.heroLegal);
  const pot = useGameStore((s) => s.pot);
  const seats = useGameStore((s) => s.seats);
  const status = useGameStore((s) => s.status);
  const awaitingNext = useGameStore((s) => s.awaitingNext);
  const setSummaryOpen = useUiStore((s) => s.setSummaryOpen);

  const currentBet = useMemo(
    () => seats.reduce((max, seat) => Math.max(max, seat.streetBet), 0),
    [seats],
  );
  const toCall = heroLegal?.call?.amount ?? 0;
  const raise = heroLegal?.raise;

  const [raiseTo, setRaiseTo] = useState(0);
  useEffect(() => {
    if (raise) setRaiseTo(raise.minTo);
  }, [raise]);

  if (!heroLegal) {
    if (awaitingNext) {
      return (
        <div className="action-bar">
          <div className="action-buttons action-buttons--between">
            <button className="btn btn--neutral" onClick={() => setSummaryOpen(true)}>
              Hand summary
            </button>
            <button className="btn btn--raise" onClick={() => tableController.continueNextHand()}>
              Deal next hand →
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="action-bar action-bar--waiting">
        <span className="waiting-text">
          {status === 'playing' ? 'Waiting for the table…' : ''}
        </span>
      </div>
    );
  }

  const clamp = (v: number) => {
    if (!raise) return v;
    const snapped = Math.round(v / 5) * 5;
    return Math.max(raise.minTo, Math.min(raise.maxTo, snapped));
  };

  const presetTo = (frac: number) => clamp(currentBet + frac * (pot + toCall));

  const presets: { label: string; value: number }[] = raise
    ? [
        { label: 'Min', value: raise.minTo },
        { label: '½ Pot', value: presetTo(0.5) },
        { label: '¾ Pot', value: presetTo(0.75) },
        { label: 'Pot', value: presetTo(1) },
        { label: 'All-in', value: raise.maxTo },
      ]
    : [];

  const isBet = currentBet === 0;
  const raiseIsAllIn = raise && raiseTo >= raise.maxTo;

  return (
    <div className="action-bar">
      <div className="action-buttons">
        <button className="btn btn--fold" onClick={() => tableController.humanAct({ type: 'fold' })}>
          Fold
        </button>
        {heroLegal.check ? (
          <button className="btn btn--call" onClick={() => tableController.humanAct({ type: 'check' })}>
            Check
          </button>
        ) : (
          <button className="btn btn--call" onClick={() => tableController.humanAct({ type: 'call' })}>
            Call {formatChips(toCall)}
            {heroLegal.call?.allIn ? ' · all-in' : ''}
          </button>
        )}
        {raise && (
          <button
            className="btn btn--raise"
            onClick={() => tableController.humanAct({ type: 'raise', amount: raiseTo })}
          >
            {raiseIsAllIn ? 'All-in' : isBet ? 'Bet' : 'Raise to'} {formatChips(raiseTo)}
          </button>
        )}
      </div>

      {raise && raise.minTo < raise.maxTo && (
        <div className="raise-controls">
          <input
            type="range"
            min={raise.minTo}
            max={raise.maxTo}
            step={5}
            value={raiseTo}
            onChange={(e) => setRaiseTo(clamp(Number(e.target.value)))}
            className="raise-slider"
          />
          <div className="raise-presets">
            {presets.map((p) => (
              <button
                key={p.label}
                className={`preset${raiseTo === p.value ? ' preset--active' : ''}`}
                onClick={() => setRaiseTo(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
