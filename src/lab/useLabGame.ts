import { useEffect, useMemo, useRef, useState } from 'react';
import { applyAction, startHand } from '../engine/gameStateMachine';
import { replayHand, type HandRecord } from '../engine/replay';
import { legalActions } from '../engine/bettingRules';
import { positionOfSeat, type GameState, type PlayerAction } from '../engine/types';
import { mulberry32, randomSeed } from '../engine/rng';
import { buildBotView, decideAction } from '../bots/botDecision';
import { PERSONALITIES } from '../bots/personalities';
import { createEmptyData, loadLabData, saveLabData, type LabData } from '../persistence/labData';
import type { DecisionSnapshot } from './analysis';

export const BOT_IDS = ['shark', 'rock', 'maniac', 'fish', 'nit'];
export const SEAT_NAMES = ['你', '林 · 均衡型', '石 · 紧手型', '焰 · 激进型', '鱼 · 跟注型', '冰 · 保守型'];

export function snapshotOf(state: GameState, preset: DecisionSnapshot['preset'], seed: number): DecisionSnapshot {
  if (state.phase === 'complete' || state.actionOn !== 0) throw new Error('当前不是你的行动轮次。');
  return {
    decisionId: `${state.handId}:${state.actionHistory.length}:${preset}`,
    seed, hero: [...state.players[0].holeCards], board: [...state.board],
    players: state.players.map(({ seatIndex, folded, totalCommitted, streetBet, stack }) => ({ seatIndex, folded, totalCommitted, streetBet, stack })),
    heroSeat: 0, currentBet: state.currentBet, lastRaiseAmount: state.lastRaiseAmount,
    bb: state.config.bigBlind, position: positionOfSeat(state, 0), phase: state.phase,
    legal: legalActions(state)!, preset, iterations: 5000,
  };
}

export function useLabGame() {
  const [data, setData] = useState<LabData>(createEmptyData);
  const current = useRef(data);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paused, setPaused] = useState(false);
  const replay = useMemo(() => data.session ? replayHand(data.session) : null, [data.session]);
  const state = replay?.steps.at(-1)?.state ?? null;

  useEffect(() => {
    let cancelled = false;
    void loadLabData().then((saved) => {
      if (!cancelled && saved) { current.current = saved; setData(saved); }
    }).catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : '无法读取本地记录，本次仍可练习。'); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  function replace(next: LabData) {
    const stamped = { ...next, savedAt: Date.now() };
    current.current = stamped;
    setData(stamped);
    void saveLabData(stamped).catch((e: unknown) => setError(e instanceof Error ? e.message : '保存失败，请导出备份。'));
  }

  function getSnapshot(s: GameState): DecisionSnapshot {
    const preset = current.current.settings.preset;
    const id = `${s.handId}:${s.actionHistory.length}:${preset}`;
    // The public decision identity is independent of the private deal seed.
    // It survives refresh/import and cannot retain a snapshot of an older state.
    let seed = 2166136261;
    for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
    return snapshotOf(s, preset, seed >>> 0);
  }

  function advance(action: PlayerAction, human = false) {
    const beforeData = current.current;
    const record = beforeData.session;
    if (!record) return;
    const before = replayHand(record).steps.at(-1)!.state;
    if (before.phase === 'complete' || (human && before.actionOn !== 0)) return;
    try {
      const decision = human ? getSnapshot(before) : null;
      const after = applyAction(before, action).state;
      if (human) setPaused(after.phase !== 'complete');
      const nextRecord: HandRecord = { ...record, actions: [...record.actions, action] };
      const decisions = decision ? [...beforeData.sessionDecisions, decision] : beforeData.sessionDecisions;
      let next: LabData = { ...beforeData, session: nextRecord, sessionDecisions: decisions };
      if (after.phase === 'complete' && !beforeData.hands.some((h) => h.record.handId === record.handId)) {
        const net = after.players[0].stack - after.players[0].startingStack;
        next = {
          ...next,
          hands: [{ record: nextRecord, completedAt: Date.now(), net, decisions }, ...beforeData.hands].slice(0, 1000),
          totals: { handsPlayed: beforeData.totals.handsPlayed + 1, netChips: beforeData.totals.netChips + net },
        };
      }
      replace(next);
    } catch (e) { setError(e instanceof Error ? e.message : '这次行动未执行，请重试。'); }
  }

  useEffect(() => {
    if (paused || !loaded || !state || state.phase === 'complete' || state.actionOn === 0 || state.actionOn === null) return;
    const record = data.session!;
    const seat = state.actionOn;
    const delay = { slow: 1200, normal: 650, fast: 180 }[data.settings.speed];
    const timer = window.setTimeout(() => {
      // Stale timers never act on a new hand or a new decision.
      if (current.current.session?.handId !== record.handId || current.current.session.actions.length !== record.actions.length) return;
      try {
        const bot = PERSONALITIES[BOT_IDS[seat - 1]];
        const rng = mulberry32((record.seed ^ Math.imul(record.actions.length + 1, 2654435761)) >>> 0);
        advance(decideAction(buildBotView(state, seat), bot, current.current.settings.difficulty, rng).action);
      } catch (e) { setError(e instanceof Error ? e.message : '机器人行动失败。'); }
    }, delay);
    return () => window.clearTimeout(timer);
  // advance reads the latest snapshot via current; session identity owns the timer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.session, data.settings.speed, loaded, paused]);

  function nextHand() {
    const prev = current.current;
    const previousState = prev.session ? replayHand(prev.session).steps.at(-1)!.state : null;
    if (previousState && previousState.phase !== 'complete') return;
    const stacks = previousState?.players.map((p) => p.stack || 1000) ?? Array<number>(6).fill(1000);
    const config = {
      smallBlind: 5, bigBlind: 10, buttonIndex: previousState ? (previousState.buttonIndex + 1) % 6 : 0,
      seats: SEAT_NAMES.map((name, i) => ({ id: i === 0 ? 'hero' : BOT_IDS[i - 1], name, stack: stacks[i], isHero: i === 0, ...(i ? { personalityId: BOT_IDS[i - 1] } : {}) })),
    };
    const seed = randomSeed();
    const record = { handId: `hand-${Date.now()}-${crypto.randomUUID()}`, config, seed, actions: [] };
    startHand(config, seed, record.handId); // validate before persisting
    setPaused(false);
    setNotice(previousState?.players[0].stack === 0 ? '已领取 1,000 枚练习筹码。' : '');
    replace({ ...prev, session: record, sessionDecisions: [] });
  }

  return { data, state, replay, loaded, error, notice, paused, resume: () => setPaused(false), replace, advance, nextHand, getSnapshot,
    clearError: () => setError(''), setNotice, setError };
}
