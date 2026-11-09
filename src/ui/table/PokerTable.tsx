import { useGameStore } from '../../store/gameStore';
import type { SeatView } from '../../store/gameStore';
import { formatChips } from '../../game/format';
import { CardView } from './CardView';
import './PokerTable.css';

export function PokerTable() {
  const seats = useGameStore((s) => s.seats);
  const board = useGameStore((s) => s.board);
  const pot = useGameStore((s) => s.pot);
  const phase = useGameStore((s) => s.phase);
  const banner = useGameStore((s) => s.banner);
  const quips = useGameStore((s) => s.quips);

  const heroIndex = Math.max(0, seats.findIndex((s) => s.isHero));
  const n = seats.length;
  const displaySlot = (seatIndex: number) => {
    if (n === 0) return 0;
    // rotate so the hero is always display slot 0 (bottom center); spread
    // remaining players around the 6 visual slots
    const rel = (seatIndex - heroIndex + n) % n;
    return n === 6 ? rel : Math.round((rel * 6) / n) % 6;
  };

  return (
    <div className="table-zone">
      <div className="table-oval">
        <div className="table-rail" />
        <div className="table-felt" />

        <div className="table-center">
          <div className="pot-pill">
            <span className="pot-label">POT</span>
            <span className="pot-amount">{formatChips(pot)}</span>
          </div>
          <div className="board-row">
            {board.map((card, i) => (
              <CardView key={card} card={card} size="board" dealIndex={i >= 3 ? 0 : i} />
            ))}
            {Array.from({ length: 5 - board.length }, (_, i) => (
              <div key={`slot-${i}`} className="board-slot" />
            ))}
          </div>
          {phase && phase !== 'complete' && <div className="phase-tag">{phase}</div>}
        </div>

        {banner && <div className="result-banner">{banner}</div>}

        {seats.map((seat) => (
          <Seat
            key={seat.seatIndex}
            seat={seat}
            slot={displaySlot(seat.seatIndex)}
            quip={quips[seat.seatIndex]?.text ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function Seat({ seat, slot, quip }: { seat: SeatView; slot: number; quip: string | null }) {
  const classes = [
    'seat',
    `seat--pos${slot}`,
    seat.folded ? 'seat--folded' : '',
    seat.isActing ? 'seat--acting' : '',
    seat.wonAmount != null ? 'seat--winner' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cardSize = seat.isHero ? 'hole' : 'mini';

  return (
    <>
      <div className={classes}>
        {seat.hasCards && (
          <div className="seat-cards">
            {seat.holeCards ? (
              <>
                <CardView card={seat.holeCards[0]} size={cardSize} dealIndex={0} dimmed={seat.folded} />
                <CardView card={seat.holeCards[1]} size={cardSize} dealIndex={1} dimmed={seat.folded} />
              </>
            ) : (
              <>
                <CardView size="mini" dealIndex={0} />
                <CardView size="mini" dealIndex={1} />
              </>
            )}
          </div>
        )}
        <div className="seat-pod">
          {quip && <div className="seat-quip">{quip}</div>}
          {seat.wonAmount != null && <span className="seat-won">+{formatChips(seat.wonAmount)}</span>}
          <span className="seat-avatar">{seat.avatar}</span>
          <span className="seat-info">
            <span className="seat-name">{seat.name}</span>
            <span className={`seat-stack${seat.allIn ? ' seat-stack--allin' : ''}`}>
              {seat.allIn ? 'ALL-IN' : formatChips(seat.stack)}
            </span>
          </span>
        </div>
        {seat.showdownDescription && <div className="seat-descr">{seat.showdownDescription}</div>}
      </div>

      {(seat.streetBet > 0 || seat.isButton || seat.lastAction) && (
        <div className={`bet-spot bet-spot--pos${slot}`}>
          {seat.isButton && <span className="dealer-button">D</span>}
          {seat.lastAction && (
            <span className="bet-chip" key={`${seat.lastAction.type}-${seat.lastAction.amount}`}>
              <span className="bet-action">{actionLabel(seat)}</span>
              {seat.lastAction.amount > 0 && <span>{formatChips(seat.lastAction.amount)}</span>}
            </span>
          )}
        </div>
      )}
    </>
  );
}

function actionLabel(seat: SeatView): string {
  const a = seat.lastAction!;
  switch (a.type) {
    case 'small blind':
      return 'SB';
    case 'big blind':
      return 'BB';
    case 'raise':
      return seat.allIn ? 'ALL-IN' : 'RAISE';
    case 'bet':
      return seat.allIn ? 'ALL-IN' : 'BET';
    case 'call':
      return seat.allIn ? 'ALL-IN' : 'CALL';
    case 'check':
      return 'CHECK';
    case 'fold':
      return 'FOLD';
  }
}
