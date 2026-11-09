import type { GameState, PlayerAction, TableConfig } from '../engine/types';
import { totalPot } from '../engine/types';
import type { HandEvent } from '../engine/events';
import type { HandRecord } from '../engine/replay';
import { applyAction, startHand } from '../engine/gameStateMachine';
import { legalActions } from '../engine/bettingRules';
import { mulberry32, randomSeed, type Rng } from '../engine/rng';
import { PERSONALITIES, type Personality } from '../bots/personalities';
import { buildBotView, decideAction } from '../bots/botDecision';
import { bluffRevealCheck } from './bluffReveal';
import { postflopAdvice, preflopAdvice } from '../coach/recommend';
import { getEquity } from '../equity/equityClient';
import { gradeHand } from '../analysis/gradeHand';
import { summarizeHand, type HandSummary } from '../analysis/handSummary';
import { saveHand, type StoredHand } from '../stats/db';
import { sounds } from './sounds';
import { useGameStore, type SeatView } from '../store/gameStore';
import { SPEED_FACTOR, useSettingsStore } from '../store/settingsStore';
import { formatCards } from './format';

interface SessionPlayer {
  id: string;
  name: string;
  isHero: boolean;
  personalityId?: string;
  stack: number;
}

const DEFAULT_BOTS = ['shark', 'rock', 'maniac', 'fish', 'nit'];
export const BUY_IN = 1000;
export const SMALL_BLIND = 5;
export const BIG_BLIND = 10;

/**
 * The only stateful orchestrator: runs hands (engine), asks bots and the
 * human for actions, paces the game, and publishes sanitized snapshots to
 * the game store. Everything below it is pure.
 */
class TableController {
  private players: SessionPlayer[] = [];
  private button = 0;
  private handNumber = 0;
  private state: GameState | null = null;
  private botRng: Rng = mulberry32(randomSeed());
  private pendingHuman: ((a: PlayerAction) => void) | null = null;
  private pendingRebuy: (() => void) | null = null;
  private sessionToken = 0;
  private lastActions = new Map<number, SeatView['lastAction']>();
  private reveals = new Map<number, string>();
  private winners = new Map<number, number>();
  private banner: string | null = null;
  /** Whether someone already bet this street (blinds count preflop). */
  private streetHasBet = true;
  private pendingNext: (() => void) | null = null;
  private lastSummary: HandSummary | null = null;
  /** Main-pot winners of the current hand (drives the summary chart marker). */
  private mainPotWinners: number[] = [];
  private quipId = 0;
  private lastQuipAt = 0;
  private lastQuipBySeat = new Map<number, number>();
  /** Unique per session so hand ids never collide across sessions/devices. */
  private sessionId = '';
  /** Completed hands, ready for Phase 4 persistence/analysis. */
  readonly history: HandRecord[] = [];

  startSession(heroName = 'You'): void {
    this.sessionToken++;
    this.pendingHuman = null;
    this.pendingRebuy = null;
    this.players = [
      { id: 'hero', name: heroName, isHero: true, stack: BUY_IN },
      ...DEFAULT_BOTS.map((pid) => ({
        id: pid,
        name: PERSONALITIES[pid].name,
        isHero: false,
        personalityId: pid,
        stack: BUY_IN,
      })),
    ];
    this.button = Math.floor(Math.random() * this.players.length);
    this.handNumber = 0;
    this.sessionId = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    this.history.length = 0;
    useGameStore.getState().reset();
    void this.runLoop(this.sessionToken);
  }

  stop(): void {
    this.sessionToken++;
    this.pendingHuman = null;
    this.pendingRebuy = null;
    this.pendingNext = null;
  }

  /** Called by the "deal next hand" button — the game waits for this. */
  continueNextHand(): void {
    const resume = this.pendingNext;
    this.pendingNext = null;
    resume?.();
  }

  /** Called by the action bar. Ignores clicks that aren't currently legal. */
  humanAct(action: PlayerAction): void {
    const resolve = this.pendingHuman;
    if (!resolve || !this.state) return;
    const la = legalActions(this.state);
    if (!la) return;
    if (action.type === 'check' && !la.check) return;
    if (action.type === 'call' && !la.call) return;
    if (action.type === 'raise') {
      if (!la.raise || action.amount == null) return;
      action = {
        type: 'raise',
        amount: Math.max(la.raise.minTo, Math.min(la.raise.maxTo, Math.round(action.amount))),
      };
    }
    this.pendingHuman = null;
    resolve(action);
  }

  rebuyHero(): void {
    const hero = this.players.find((p) => p.isHero);
    if (!hero || hero.stack > 0) return;
    hero.stack = BUY_IN;
    useGameStore.getState().appendLog([`You buy back in for ${BUY_IN}`]);
    const resume = this.pendingRebuy;
    this.pendingRebuy = null;
    resume?.();
  }

  // -------------------------------------------------------------------------

  private async runLoop(token: number): Promise<void> {
    while (token === this.sessionToken) {
      await this.playHand(token);
      if (token !== this.sessionToken) return;
      // let the winner banner land, then pause for study until the player
      // asks for the next hand
      await this.delay(1500);
      if (token !== this.sessionToken) return;
      useGameStore.getState().publish({ summary: this.lastSummary, awaitingNext: true });
      await new Promise<void>((res) => {
        this.pendingNext = res;
      });
      if (token !== this.sessionToken) return;
      useGameStore.getState().publish({ summary: null, awaitingNext: false });

      for (const p of this.players) {
        if (!p.isHero && p.stack === 0) {
          p.stack = BUY_IN;
          useGameStore.getState().appendLog([`${p.name} buys back in for ${BUY_IN}`]);
        }
      }
      const hero = this.players.find((p) => p.isHero)!;
      if (hero.stack === 0) {
        useGameStore.getState().publish({ status: 'heroBusted', heroLegal: null });
        await new Promise<void>((res) => {
          this.pendingRebuy = res;
        });
        if (token !== this.sessionToken) return;
      }
      this.button = (this.button + 1) % this.players.length;
    }
  }

  private async playHand(token: number): Promise<void> {
    this.handNumber++;
    this.lastActions.clear();
    this.reveals.clear();
    this.winners.clear();
    this.mainPotWinners = [];
    this.banner = null;
    this.streetHasBet = true; // blinds are live bets preflop

    const seed = randomSeed();
    const config: TableConfig = {
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      buttonIndex: this.button,
      seats: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        stack: p.stack,
        isHero: p.isHero,
        personalityId: p.personalityId,
      })),
    };
    const started = startHand(config, seed, `hand-${this.sessionId}-${this.handNumber}`);
    this.state = started.state;
    useGameStore.getState().publish({ handNumber: this.handNumber, banner: null, review: null });
    this.consumeEvents(started.events);
    this.publishSnapshot();

    while (this.state.phase !== 'complete' && token === this.sessionToken) {
      const seat = this.state.actionOn!;
      const player = this.state.players[seat];
      let action: PlayerAction;

      if (player.isHero) {
        const la = legalActions(this.state)!;
        const humanPromise = new Promise<PlayerAction>((res) => {
          this.pendingHuman = res;
        });
        this.publishSnapshot({ heroLegal: la, coach: null });
        sounds.yourTurn();
        void this.computeCoach(token, this.handNumber, seat);
        action = await humanPromise;
        if (token !== this.sessionToken) return;
        this.publishSnapshot({ heroLegal: null, coach: null });
      } else {
        await this.delay(450 + this.botRng() * 950);
        if (token !== this.sessionToken) return;
        const personality = PERSONALITIES[this.players[seat].personalityId!];
        const view = buildBotView(this.state, seat);
        const difficulty = useSettingsStore.getState().difficulty;
        action = decideAction(view, personality, difficulty, this.botRng).action;
      }

      const r = applyAction(this.state, action);
      this.state = r.state;
      this.consumeEvents(r.events);
      this.publishSnapshot();
      if (r.events.some((e) => e.type === 'streetDealt')) await this.delay(650);
      if (r.events.some((e) => e.type === 'showdown')) await this.delay(900);
    }

    if (token !== this.sessionToken) return;
    for (const ps of this.state.players) {
      this.players[ps.seatIndex].stack = ps.stack;
    }
    const record: HandRecord = {
      handId: this.state.handId,
      config,
      seed,
      actions: this.state.actionHistory,
    };
    this.history.push(record);
    this.publishSnapshot({ heroLegal: null });

    // Grade the hero's decisions and persist the hand. Synchronous so the
    // run loop can hold the table longer when there's something to learn.
    const heroSeat = this.state.players.findIndex((p) => p.isHero);
    const heroNet = this.state.players[heroSeat].stack - this.state.players[heroSeat].startingStack;
    const heroSatOut =
      this.state.players[heroSeat].folded && this.state.players[heroSeat].totalCommitted === 0;
    const bluffShown = this.maybeRevealBluff();
    if (bluffShown) this.publishSnapshot({ heroLegal: null }); // show the flipped cards
    this.lastSummary = {
      ...summarizeHand(this.state, this.reveals.size > 0, this.mainPotWinners, this.winners),
      bluffShown,
    };
    try {
      const grade = gradeHand(record, heroSeat);
      // don't nag about hands where the hero just folded pre for free
      if (!heroSatOut || grade.mistakes + grade.blunders > 0) {
        useGameStore.getState().publish({ review: grade });
      }
      const stored: StoredHand = {
        handId: record.handId,
        timestamp: Date.now(),
        record,
        heroSeatIndex: heroSeat,
        grade,
        net: heroNet,
      };
      void saveHand(stored);
    } catch (err) {
      console.error('post-hand grading failed', err);
    }
  }

  /**
   * Computes coach advice for the hero's current decision. Preflop is an
   * instant chart lookup; postflop runs Monte Carlo equity in the worker.
   * Discards the result if the decision point has moved on.
   */
  private async computeCoach(token: number, handNumber: number, seat: number): Promise<void> {
    if (!useSettingsStore.getState().coachEnabled) return;
    const st = this.state;
    if (!st || st.actionOn !== seat) return;
    const view = buildBotView(st, seat);
    if (view.phase === 'preflop') {
      useGameStore.getState().publish({ coach: preflopAdvice(view) });
      return;
    }
    useGameStore.getState().publish({
      coach: {
        action: 'check',
        headline: 'Coach is thinking…',
        reasoning: 'Running the numbers on your hand.',
        handNow: '',
        pending: true,
      },
    });
    const eq = await getEquity({
      hero: view.holeCards,
      board: view.board,
      opponents: view.numActive - 1,
      iterations: 5000,
    });
    // stale guard: only publish if we're still on the same decision
    if (
      token !== this.sessionToken ||
      handNumber !== this.handNumber ||
      this.state?.actionOn !== seat ||
      this.pendingHuman === null
    ) {
      return;
    }
    useGameStore.getState().publish({ coach: postflopAdvice(view, eq) });
  }

  /**
   * Occasionally lets a bot say something in character. Rate-limited: one
   * quip per 6s globally and per 18s per bot, so the table never gets loud.
   */
  private maybeQuip(seatIndex: number, kind: keyof Personality['quips'], probability: number): void {
    const player = this.players[seatIndex];
    if (!player?.personalityId) return;
    const now = Date.now();
    if (now - this.lastQuipAt < 6000) return;
    if (now - (this.lastQuipBySeat.get(seatIndex) ?? 0) < 18_000) return;
    if (this.botRng() > probability) return;
    this.emitQuip(seatIndex, kind);
  }

  /** Publishes a quip bubble unconditionally (cooldowns handled by callers). */
  private emitQuip(seatIndex: number, kind: keyof Personality['quips']): void {
    const player = this.players[seatIndex];
    if (!player?.personalityId) return;
    const lines = PERSONALITIES[player.personalityId].quips[kind];
    if (lines.length === 0) return;
    const text = lines[Math.floor(this.botRng() * lines.length)];
    this.lastQuipAt = Date.now();
    this.lastQuipBySeat.set(seatIndex, this.lastQuipAt);
    const id = ++this.quipId;
    useGameStore.getState().publish({ quips: { ...useGameStore.getState().quips, [seatIndex]: { text, id } } });
    setTimeout(() => {
      const current = useGameStore.getState().quips;
      if (current[seatIndex]?.id !== id) return;
      const next = { ...current };
      delete next[seatIndex];
      useGameStore.getState().publish({ quips: next });
    }, 4500);
  }

  /**
   * After winning without a showdown, a bot sometimes flips over a weak hand
   * to show the bluff — how often depends on personality. This is what makes
   * bluffing visible (and painful) enough to learn from.
   */
  private maybeRevealBluff(): boolean {
    const st = this.state;
    if (!st || this.reveals.size > 0 || this.mainPotWinners.length !== 1) return false;
    const seat = this.mainPotWinners[0];
    const player = this.players[seat];
    if (!player?.personalityId) return false; // the hero shows his own bluffs
    const ps = st.players[seat];
    const desc = bluffRevealCheck(
      PERSONALITIES[player.personalityId],
      ps.holeCards,
      st.board,
      this.botRng,
    );
    if (!desc) return false;
    this.reveals.set(seat, `${desc} — a stone-cold bluff`);
    useGameStore
      .getState()
      .appendLog([`${player.name} shows the bluff: ${formatCards(ps.holeCards)} — just ${desc}!`]);
    this.emitQuip(seat, 'showBluff');
    return true;
  }

  private consumeEvents(events: HandEvent[]): void {
    const name = (seat: number) => this.players[seat].name;
    // "You call" vs "Selena calls"
    const verb = (seat: number, v: string) => (this.players[seat].isHero ? v : `${v}s`);
    const lines: string[] = [];
    for (const e of events) {
      switch (e.type) {
        case 'handStarted':
          lines.push(`— Hand #${this.handNumber} —`);
          break;
        case 'holeCardsDealt':
          break;
        case 'blindPosted':
          this.lastActions.set(e.seatIndex, {
            type: e.kind === 'small' ? 'small blind' : 'big blind',
            amount: e.amount,
          });
          lines.push(`${name(e.seatIndex)} posts the ${e.kind} blind (${e.amount})`);
          break;
        case 'actionTaken': {
          const allIn = e.allIn ? ' — all-in!' : '';
          const isBet = e.action === 'raise' && !this.streetHasBet;
          if (e.action === 'fold') sounds.fold();
          else if (e.action === 'check') sounds.check();
          else if (e.allIn) sounds.allIn();
          else sounds.chips();
          if (e.allIn && e.action === 'raise') this.maybeQuip(e.seatIndex, 'allIn', 0.5);
          else if (e.action === 'raise') this.maybeQuip(e.seatIndex, 'raise', 0.12);
          else if (e.action === 'fold') this.maybeQuip(e.seatIndex, 'fold', 0.08);
          if (e.action === 'fold') lines.push(`${name(e.seatIndex)} ${verb(e.seatIndex, 'fold')}`);
          else if (e.action === 'check') lines.push(`${name(e.seatIndex)} ${verb(e.seatIndex, 'check')}`);
          else if (e.action === 'call')
            lines.push(`${name(e.seatIndex)} ${verb(e.seatIndex, 'call')} ${e.amount}${allIn}`);
          else if (isBet)
            lines.push(`${name(e.seatIndex)} ${verb(e.seatIndex, 'bet')} ${e.toStreetBet}${allIn}`);
          else lines.push(`${name(e.seatIndex)} ${verb(e.seatIndex, 'raise')} to ${e.toStreetBet}${allIn}`);
          if (e.action === 'raise') this.streetHasBet = true;
          this.lastActions.set(e.seatIndex, {
            type: isBet ? 'bet' : e.action,
            amount: e.action === 'raise' ? e.toStreetBet : e.amount,
          });
          break;
        }
        case 'streetDealt':
          sounds.deal();
          this.lastActions.clear();
          this.streetHasBet = false;
          lines.push(`${e.street[0].toUpperCase() + e.street.slice(1)}: ${formatCards(e.board)}`);
          break;
        case 'showdown':
          for (const r of e.reveals) {
            this.reveals.set(r.seatIndex, r.description);
            lines.push(`${name(r.seatIndex)} shows ${formatCards(r.cards)} — ${r.description}`);
          }
          break;
        case 'uncalledBetReturned':
          lines.push(`Uncalled bet (${e.amount}) returned to ${name(e.seatIndex)}`);
          break;
        case 'potAwarded': {
          if (e.potIndex === 0) this.mainPotWinners = e.winners.map((w) => w.seatIndex);
          for (const w of e.winners) {
            this.winners.set(w.seatIndex, (this.winners.get(w.seatIndex) ?? 0) + w.amount);
            const withHand = w.description ? ` with ${w.description}` : '';
            lines.push(`${name(w.seatIndex)} wins ${w.amount}${withHand}`);
            if (!this.banner) this.banner = `${name(w.seatIndex)} wins ${w.amount}${withHand}`;
            if (this.players[w.seatIndex].isHero) sounds.win();
            else this.maybeQuip(w.seatIndex, e.amount >= 400 ? 'bigWin' : 'win', e.amount >= 400 ? 0.7 : 0.3);
          }
          break;
        }
        case 'handComplete':
          break;
      }
    }
    if (lines.length > 0) useGameStore.getState().appendLog(lines);
  }

  private publishSnapshot(overrides?: Partial<Parameters<ReturnType<typeof useGameStore.getState>['publish']>[0]>): void {
    const st = this.state;
    if (!st) return;
    const seats: SeatView[] = st.players.map((p) => {
      const personality = this.players[p.seatIndex].personalityId
        ? PERSONALITIES[this.players[p.seatIndex].personalityId!]
        : null;
      const revealed = this.reveals.has(p.seatIndex);
      return {
        seatIndex: p.seatIndex,
        id: p.id,
        name: p.name,
        isHero: p.isHero,
        avatar: p.isHero ? '🧑' : personality!.avatar,
        personalityTagline: personality?.tagline ?? null,
        stack: p.stack,
        streetBet: p.streetBet,
        folded: p.folded,
        allIn: p.allIn,
        holeCards: p.isHero || revealed ? p.holeCards : null,
        hasCards: !p.folded && (st.phase !== 'complete' || revealed || p.isHero),
        isButton: st.buttonIndex === p.seatIndex,
        isActing: st.actionOn === p.seatIndex,
        lastAction: this.lastActions.get(p.seatIndex) ?? null,
        showdownDescription: this.reveals.get(p.seatIndex) ?? null,
        wonAmount: this.winners.get(p.seatIndex) ?? null,
        sittingOut: false,
      };
    });
    useGameStore.getState().publish({
      phase: st.phase,
      seats,
      board: [...st.board],
      pot: totalPot(st),
      bigBlind: BIG_BLIND,
      status: st.phase === 'complete' ? 'handComplete' : 'playing',
      banner: st.phase === 'complete' ? this.banner : null,
      ...overrides,
    });
  }

  private delay(ms: number): Promise<void> {
    const factor = SPEED_FACTOR[useSettingsStore.getState().speed];
    return new Promise((res) => setTimeout(res, ms * factor));
  }
}

export const tableController = new TableController();
