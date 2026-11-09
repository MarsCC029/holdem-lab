import type { Card } from '../../engine/types';
import { isRedSuit, rankLabel, suitSymbol } from '../../game/format';

interface CardViewProps {
  /** Undefined renders a face-down card back. */
  card?: Card;
  size?: 'board' | 'hole' | 'mini';
  /** Stagger index for the deal-in animation. */
  dealIndex?: number;
  dimmed?: boolean;
}

export function CardView({ card, size = 'board', dealIndex = 0, dimmed = false }: CardViewProps) {
  const classes = ['card', `card--${size}`, dimmed ? 'card--dimmed' : '']
    .filter(Boolean)
    .join(' ');
  if (!card) {
    return (
      <div className={`${classes} card--back`} style={{ animationDelay: `${dealIndex * 90}ms` }}>
        <div className="card-back-pattern" />
      </div>
    );
  }
  const red = isRedSuit(card);
  return (
    <div
      className={`${classes} ${red ? 'card--red' : 'card--black'}`}
      style={{ animationDelay: `${dealIndex * 90}ms` }}
    >
      <span className="card-corner">
        <b>{rankLabel(card)}</b>
        <i>{suitSymbol(card)}</i>
      </span>
      <span className="card-pip">{suitSymbol(card)}</span>
    </div>
  );
}
