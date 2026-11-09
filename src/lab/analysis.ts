import type { Card, LegalActions, Position, Street } from '../engine/types';
import { buildPots } from '../engine/potManager';
import { RANGE_PRESETS, RANGE_VERSION, simulateRangeEquity, validDistinctCards } from '../equity/ranges';
import type { RangePreset } from '../equity/ranges';

export type { RangePreset } from '../equity/ranges';
export interface PublicPlayer {
  seatIndex: number;
  folded: boolean;
  totalCommitted: number;
  streetBet: number;
  stack: number;
}
/** Public-information DTO only. seed is an independent analysis seed, never the deal seed. */
export interface DecisionSnapshot {
  decisionId: string;
  seed: number;
  hero: [Card, Card];
  board: Card[];
  players: PublicPlayer[];
  heroSeat: number;
  currentBet: number;
  lastRaiseAmount: number;
  bb: number;
  position: Position;
  phase: Street;
  legal: LegalActions;
  preset: RangePreset;
  iterations?: number;
}
export interface DecisionAnalysis {
  decisionId: string;
  status: 'ok' | 'insufficient-samples' | 'invalid-input';
  /** Expected pot share against all active opponents, including split ties. */
  equity: number;
  win: number;
  tie: number;
  samples: number;
  standardError: number;
  /** Eligible current pot, excluding the hypothetical alternative of calling. */
  eligiblePot: number;
  toCall: number;
  /** EV of the call alternative, independent of the action the player eventually chooses. */
  callEV: number;
  /** Ordinary unclosed betting rounds use a flat pot, never fictional short-stack layers. */
  potModel: 'flat' | 'eligible-layers';
  /** Another active, non-all-in player still faces an unmatched wager. */
  pendingResponses: boolean;
  /** No single whole-table equity threshold in side-pot cases. */
  requiredEquity: number | null;
  explanation: string;
  rangeLabel: string;
  rangeVersion: string;
  error?: string;
}
export function failedAnalysis(decisionId: string, error: string): DecisionAnalysis {
  return { decisionId, status: 'invalid-input', equity: 0, win: 0, tie: 0, samples: 0,
    standardError: 0, eligiblePot: 0, toCall: 0, callEV: 0, requiredEquity: null,
    potModel: 'flat', pendingResponses: false,
    explanation: error, rangeLabel: '示例假设范围', rangeVersion: RANGE_VERSION, error };
}
function validSnapshot(s: DecisionSnapshot): boolean {
  const allowed = new Set(['decisionId', 'seed', 'hero', 'board', 'players', 'heroSeat', 'currentBet', 'lastRaiseAmount', 'bb', 'position', 'phase', 'legal', 'preset', 'iterations']);
  const safeChips = (n: number) => Number.isSafeInteger(n) && n >= 0;
  const la = s.legal;
  return typeof s.decisionId === 'string' && s.decisionId.length > 0 && s.decisionId.length < 300 &&
    Object.keys(s).every((key) => allowed.has(key)) &&
    Number.isInteger(s.seed) && s.seed >= 0 && s.seed <= 0xffffffff &&
    (s.iterations === undefined || Number.isInteger(s.iterations) && s.iterations >= 1 && s.iterations <= 50_000) &&
    Array.isArray(s.hero) && s.hero.length === 2 && Array.isArray(s.board) &&
    validDistinctCards([...s.hero, ...s.board]) &&
    ({ preflop: 0, flop: 3, turn: 4, river: 5 }[s.phase] === s.board.length) &&
    ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'].includes(s.position) && Object.hasOwn(RANGE_PRESETS, s.preset) &&
    [s.currentBet, s.lastRaiseAmount, s.bb].every(safeChips) && s.bb > 0 && s.lastRaiseAmount > 0 &&
    Array.isArray(s.players) && s.players.length >= 2 && s.players.length <= 6 &&
    new Set(s.players.map((p) => p.seatIndex)).size === s.players.length &&
    s.players.every((p) => Object.keys(p).every((key) => ['seatIndex', 'folded', 'totalCommitted', 'streetBet', 'stack'].includes(key)) &&
      Number.isInteger(p.seatIndex) && p.seatIndex >= 0 && p.seatIndex < 6 && typeof p.folded === 'boolean' &&
      [p.stack, p.streetBet, p.totalCommitted].every(safeChips) &&
      p.totalCommitted >= p.streetBet && p.streetBet <= s.currentBet) &&
    Number.isSafeInteger(s.players.reduce((sum, p) => sum + p.totalCommitted + p.stack, 0)) &&
    !!la && la.seatIndex === s.heroSeat && typeof la.fold === 'boolean' && typeof la.check === 'boolean' &&
    Object.keys(la).every((key) => ['seatIndex', 'fold', 'check', 'call', 'raise'].includes(key)) &&
    (la.call === undefined || !!la.call && !Array.isArray(la.call) && safeChips(la.call.amount) && typeof la.call.allIn === 'boolean' &&
      Object.keys(la.call).every((key) => ['amount', 'allIn'].includes(key))) &&
    (la.raise === undefined || !!la.raise && !Array.isArray(la.raise) && safeChips(la.raise.minTo) && safeChips(la.raise.maxTo) && la.raise.minTo <= la.raise.maxTo &&
      Object.keys(la.raise).every((key) => ['minTo', 'maxTo'].includes(key))) &&
    s.players.some((p) => p.seatIndex === s.heroSeat && !p.folded);
}
/** Strict import boundary: rejects extra private fields as well as malformed numeric/card data. */
export function isDecisionSnapshot(value: unknown): value is DecisionSnapshot {
  try { return !!value && typeof value === 'object' && validSnapshot(value as DecisionSnapshot); }
  catch { return false; }
}
/** Pure Worker calculation. No actual opponent hand or future public card is accepted. */
export function computeDecisionAnalysis(snapshot: DecisionSnapshot): DecisionAnalysis {
  const decisionId = typeof snapshot?.decisionId === 'string' ? snapshot.decisionId : '';
  try {
    if (!isDecisionSnapshot(snapshot)) return failedAnalysis(decisionId, '分析快照无效，未计算建议。');
    const hero = snapshot.players.find((p) => p.seatIndex === snapshot.heroSeat);
    const opponents = snapshot.players.filter((p) => !p.folded && p.seatIndex !== snapshot.heroSeat);
    if (!hero || hero.folded || opponents.length === 0) return failedAnalysis(decisionId, '此局面没有待分析的有效对手。');
    const toCall = Math.min(snapshot.currentBet - hero.streetBet, hero.stack);
    const currentPot = snapshot.players.reduce((sum, p) => sum + p.totalCommitted, 0);
    const hasAllIn = snapshot.players.some((p) => !p.folded && p.stack === 0) || (toCall > 0 && toCall === hero.stack);
    const potModel = hasAllIn ? 'eligible-layers' : 'flat';
    const pendingResponses = opponents.some((p) => p.stack > 0 && p.streetBet < snapshot.currentBet);
    // A still-pending blind/caller is not a short all-in. Only actual stack
    // caps justify slicing present contributions into eligibility layers.
    const built = hasAllIn ? buildPots(snapshot.players.map((p) => ({ seatIndex: p.seatIndex, folded: p.folded,
      totalCommitted: p.totalCommitted + (p.seatIndex === snapshot.heroSeat ? toCall : 0) }))) : null;
    const pots = built?.pots.filter((p) => p.eligible.includes(snapshot.heroSeat)) ?? [];
    const afterEligible = pots.reduce((sum, p) => sum + p.amount, 0);
    const returned = built?.uncalled?.seatIndex === snapshot.heroSeat ? built.uncalled.amount : 0;
    const eligiblePot = hasAllIn ? Math.max(0, afterEligible + returned - toCall) : currentPot;
    const samePot = pots.length === 1 && pots[0].eligible.length === opponents.length + 1;
    const requiredEquity = toCall === 0 ? null : !hasAllIn ? toCall / (currentPot + toCall)
      : samePot && !pendingResponses && afterEligible > 0 ? toCall / afterEligible : null;
    let payoutSum = 0;
    const result = simulateRangeEquity({ hero: snapshot.hero, board: snapshot.board,
      opponents: opponents.map((p) => ({ seatIndex: p.seatIndex, preset: snapshot.preset })),
      seed: snapshot.seed, iterations: snapshot.iterations ?? 5000 }, ({ heroRank, opponentRanks }) => {
      let payout = returned;
      for (const pot of pots) {
        let best = heroRank, winners = 1;
        for (const seat of pot.eligible) {
          if (seat === snapshot.heroSeat) continue;
          const rank = opponentRanks.get(seat);
          if (rank == null) throw new Error('底池资格与公开座位不一致');
          if (rank < best) { best = rank; winners = 1; }
          else if (rank === best) winners++;
        }
        if (heroRank === best) payout += pot.amount / winners;
      }
      payoutSum += payout;
    });
    const callEV = result.samples ? hasAllIn ? payoutSum / result.samples - toCall
      : result.equity * (currentPot + toCall) - toCall : 0;
    const rangeLabel = `${RANGE_PRESETS[snapshot.preset].label} · 示例假设范围`;
    const caveat = pendingResponses ? hasAllIn
      ? '仍有玩家尚未完成跟注；以下只是按当前投入与全下上限作临时资格估算，并非已形成的最终边池，后续行动会改变底池。'
      : '仍有玩家尚未完成行动，其当前较少的投入不代表全下或已经形成边池。'
      : '';
    const math = toCall > 0
      ? `若选择跟注，需补 ${toCall} 筹码；${hasAllIn ? '按当前资格可争夺的' : '当前'}底池 ${eligiblePot}。${requiredEquity == null ? pendingResponses ? '暂不提供单一权益阈值。' : '底池资格不同，不能用单一全桌权益阈值判断。' : `盈亏平衡权益约 ${(requiredEquity * 100).toFixed(1)}%。`}静态摊牌模型中，跟注这一备选方案的 EV 约 ${callEV >= 0 ? '+' : ''}${callEV.toFixed(1)} 筹码。`
      : '现在可免费过牌，无须投入新筹码；权益仅作理解局面的参考。';
    const explanation = result.status !== 'ok' ? result.error ?? '有效样本不足，暂不提供数学结论。'
      : `${math}${caveat}范围是你选择的示例假设，未从对手行为推断。计算只计当前投入与假设的跟注金额，假设其后没有新增筹码并直接摊牌；未预测后续下注、弃牌或范围变化，不能作为最优行动或保证盈利的结论。`;
    return { decisionId, status: result.status, equity: result.equity, win: result.win, tie: result.tie,
      samples: result.samples, standardError: result.standardError, eligiblePot, toCall, callEV,
      requiredEquity, explanation, rangeLabel, rangeVersion: RANGE_VERSION, potModel, pendingResponses,
      ...(result.error ? { error: result.error } : {}) };
  } catch (error) {
    return failedAnalysis(decisionId, error instanceof Error ? error.message : '分析失败，请重试。');
  }
}
