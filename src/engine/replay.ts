import type { GameState, PlayerAction, TableConfig } from './types';
import type { HandEvent } from './events';
import { applyAction, startHand } from './gameStateMachine';

/** Everything needed to rebuild a hand exactly: {config, seed, actions}. */
export interface HandRecord {
  handId: string;
  config: TableConfig;
  seed: number;
  actions: PlayerAction[];
}

export interface ReplayStep {
  /** State after this step. Step 0 is the post-deal, post-blinds state. */
  state: GameState;
  events: HandEvent[];
  /** The action that produced this step (undefined for step 0). */
  action?: PlayerAction;
  /** Seat that acted (undefined for step 0). */
  seatIndex?: number;
}

/**
 * Rebuilds every intermediate state of a recorded hand. Powers the replay
 * viewer scrubber and post-hand analysis (which needs the exact state facing
 * the hero at each decision point).
 */
export function replayHand(record: HandRecord): { steps: ReplayStep[]; allEvents: HandEvent[] } {
  const start = startHand(record.config, record.seed, record.handId);
  const steps: ReplayStep[] = [{ state: start.state, events: start.events }];
  const allEvents: HandEvent[] = [...start.events];
  let current = start.state;
  for (const action of record.actions) {
    const seatIndex = current.actionOn;
    if (seatIndex === null) {
      throw new Error(`Replay of ${record.handId} has more actions than the hand allows`);
    }
    const r = applyAction(current, action);
    steps.push({ state: r.state, events: r.events, action, seatIndex });
    allEvents.push(...r.events);
    current = r.state;
  }
  return { steps, allEvents };
}

export function finalStateOf(record: HandRecord): GameState {
  const { steps } = replayHand(record);
  return steps[steps.length - 1].state;
}
