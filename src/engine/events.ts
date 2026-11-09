import type { ActionType, Card } from './types';

/**
 * Typed event log emitted by the engine. One source of truth, three consumers:
 * UI animations, post-hand analysis/replay, and stats aggregation.
 *
 * Events contain full information (including bot hole cards) — the log is
 * local to the player's machine. The UI layer sanitizes what it renders.
 */
export type HandEvent =
  | {
      type: 'handStarted';
      handId: string;
      buttonIndex: number;
      smallBlind: number;
      bigBlind: number;
      players: { seatIndex: number; id: string; name: string; stack: number }[];
    }
  | { type: 'holeCardsDealt'; cards: { seatIndex: number; cards: [Card, Card] }[] }
  | { type: 'blindPosted'; seatIndex: number; kind: 'small' | 'big'; amount: number; allIn: boolean }
  | {
      type: 'actionTaken';
      seatIndex: number;
      action: ActionType;
      /** Chips added to the pot by this action (0 for fold/check). */
      amount: number;
      /** The player's resulting street total. */
      toStreetBet: number;
      allIn: boolean;
    }
  | { type: 'streetDealt'; street: 'flop' | 'turn' | 'river'; cards: Card[]; board: Card[] }
  | {
      type: 'showdown';
      reveals: { seatIndex: number; cards: [Card, Card]; description: string }[];
    }
  | { type: 'uncalledBetReturned'; seatIndex: number; amount: number }
  | {
      type: 'potAwarded';
      potIndex: number;
      amount: number;
      winners: { seatIndex: number; amount: number; description?: string }[];
    }
  | {
      type: 'handComplete';
      results: { seatIndex: number; net: number; stack: number }[];
    };
