import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLabGame, SEAT_NAMES } from '../lab/useLabGame';
import { analyzeDecision } from '../lab/analysisClient';
import type { DecisionAnalysis, DecisionSnapshot } from '../lab/analysis';
import { replayHand } from '../engine/replay';
import { legalActions } from '../engine/bettingRules';
import { analyzeHand } from '../engine/handEval';
import { positionOfSeat, totalPot, type GameState, type PlayerAction } from '../engine/types';
import type { HandEvent } from '../engine/events';
import { handLabel } from '../bots/preflopTiers';
import { RANGE_PRESETS, rangeCombos, type RangePreset } from '../equity/ranges';
import { startOffline, type OfflineController, type OfflineStatus } from '../offline/client';
import { clearLabData, createEmptyData, prepareBackup, MAX_BACKUP_BYTES, parseBackup, type LabData, type SavedLabHand } from '../persistence/labData';
import { TrainingView } from '../training/TrainingView';
import { GlossaryView, Term, type TermId } from '../terminology';

type Inspection = { snapshot: DecisionSnapshot; result?: DecisionAnalysis; action?: PlayerAction };
type View = 'play' | 'training' | 'review' | 'glossary' | 'settings';
const STREETS: Record<string, string> = { preflop: '翻前 Preflop', flop: '翻牌 Flop', turn: '转牌 Turn', river: '河牌 River', complete: '本手结束' };
const CATEGORY = ['同花顺 Straight Flush', '四条 Quads', '葫芦 Full House', '同花 Flush', '顺子 Straight', '三条 Three of a Kind', '两对 Two Pair', '一对 One Pair', '高牌 High Card'];
const AVATARS = ['你', '林', '石', '焰', '鱼', '冰'];
const NAV: { id: View; symbol: string; label: string; en: string }[] = [
  { id: 'play', symbol: '♠', label: '实战牌桌', en: 'PLAY & LEARN' },
  { id: 'training', symbol: '◎', label: '专项训练', en: 'MATH DRILLS' },
  { id: 'review', symbol: '↺', label: '牌局复盘', en: 'HAND REVIEW' },
  { id: 'glossary', symbol: 'Aa', label: '扑克术语', en: 'POKER GLOSSARY' },
];
const number = (n: number) => n.toLocaleString('zh-CN');
const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

export function App() {
  const game = useLabGame();
  const { data, state, loaded } = game;
  const [view, setView] = useState<View>('play');
  const [online, setOnline] = useState(navigator.onLine);
  const [offline, setOffline] = useState<OfflineStatus>({ ready: false, updateAvailable: false });
  const offlineController = useRef<OfflineController | null>(null);
  const [inspection, setInspection] = useState<Inspection>();
  const analysisId = useRef('');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [selectedHand, setSelectedHand] = useState('');
  const heroTurn = state?.phase !== 'complete' && state?.actionOn === 0;
  const decisionKey = state ? `${state.handId}:${state.actionHistory.length}` : '';

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    let alive = true;
    void startOffline((status) => { if (alive) setOffline(status); }).then((controller) => {
      if (alive) offlineController.current = controller; else controller.dispose();
    });
    return () => { alive = false; offlineController.current?.dispose(); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (heroTurn) { analysisId.current = ''; setInspection(undefined); }
  }, [decisionKey, heroTurn]);

  function inspect(snapshot: DecisionSnapshot, action?: PlayerAction) {
    analysisId.current = snapshot.decisionId;
    setInspection({ snapshot, action });
    void analyzeDecision(snapshot).then((result) => {
      if (analysisId.current === result.decisionId) setInspection({ snapshot, result, action });
    }).catch((error: unknown) => { game.setError(error instanceof Error ? error.message : '计算失败，请重试。'); setInspection(undefined); });
  }
  function act(action: PlayerAction) {
    if (!state || !heroTurn) return;
    const snapshot = game.getSnapshot(state);
    game.advance(action, true);
    inspect(snapshot, action);
  }
  function hint() { if (state && heroTurn) inspect(game.getSnapshot(state)); }
  function navigate(next: View) { setView(next); window.scrollTo({ top: 0, behavior: 'instant' }); if (next !== 'play') { analysisId.current = ''; setInspection(undefined); } }
  const activeReview = data.hands.find((h) => h.record.handId === selectedHand) ?? data.hands[0];
  const inProgress = state !== null && state.phase !== 'complete';
  const attempts = Object.values(data.training).reduce((n, p) => n + p.attempts, 0);
  const correct = Object.values(data.training).reduce((n, p) => n + p.correct, 0);
  const settings = (patch: Partial<LabData['settings']>) => game.replace({ ...data, settings: { ...data.settings, ...patch } });

  return <div className="lab-shell">
    <aside className="lab-sidebar">
      <button className="lab-brand" onClick={() => navigate('play')} aria-label="筹码实验室首页"><span className="brand-mark">♠</span><span><strong>筹码实验室</strong><small>HOLD’EM LAB</small></span></button>
      <div className="sidebar-label">你的扑克训练场</div>
      <nav aria-label="主导航">{NAV.map((item) => <button key={item.id} className={`lab-nav ${view === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><span className="nav-symbol">{item.symbol}</span><span>{item.label}<small>{item.en}</small></span><span className="nav-arrow">↗</span></button>)}</nav>
      <div className="sidebar-note"><span className="tiny-diamond">◇</span><strong>先判断，再看解析。</strong><p>把直觉变成有依据的行动。<br />一手牌，一次进步。</p></div>
      <button className={`lab-nav settings-nav ${view === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><span className="nav-symbol">⚙</span><span>设置与离线<small>SETTINGS & OFFLINE</small></span></button>
      <div className="sidebar-bottom">100% 练习筹码 · 无需账号</div>
    </aside>

    <main className="lab-main">
      <header className="lab-topbar"><span className="mobile-brand">♠ 筹码实验室</span><span className="topbar-path">HOLD’EM LAB <span>/</span> {NAV.find((n) => n.id === view)?.en ?? 'SETTINGS'}</span><button className={`offline-pill ${offline.ready ? 'ready' : ''}`} onClick={() => navigate('settings')}><i />{offline.ready ? (online ? '已可离线使用' : '离线练习中') : import.meta.env.DEV ? '本地开发预览' : offline.error ? '离线缓存待检查' : '准备离线资源…'}</button></header>
      <div className="lab-content">
        <div className="page-heading"><div><p className="eyebrow">{view === 'play' ? 'PRACTICE WITH PURPOSE' : view === 'training' ? 'TRAIN YOUR POKER MATH' : view === 'review' ? 'LEARN FROM EVERY HAND' : view === 'glossary' ? 'SPEAK THE LANGUAGE' : 'MADE FOR YOUR IPHONE'}</p><h1>{view === 'play' ? <>把每一次行动，<em>算明白。</em></> : view === 'training' ? '练出你的计算直觉。' : view === 'review' ? '好决策，值得再看一遍。' : view === 'glossary' ? '听懂牌桌上的每一句。' : '随时打开，随处练习。'}</h1><p className="page-subtitle">{view === 'play' ? '六人桌无限注德州扑克 · 与五种风格的对手，练习有依据的决策。' : view === 'training' ? '从补牌到范围权益，把复杂局面拆成一道道可解的题。' : view === 'review' ? '回到行动发生的那一刻，复查当时的范围假设和计算。' : view === 'glossary' ? '标准英文、中文解释和具体例子，建立你的扑克词典。' : '离线安装、本地备份与牌桌偏好，都在这里。'}</p></div><span className="heading-card"><b>♠</b><span>LEARN.<br />THINK.<br />PLAY.</span></span></div>
        {game.error && <div className="lab-alert" role="alert">{game.error}<button onClick={game.clearError}>关闭</button></div>}
        {game.notice && <div className="lab-notice" role="status">{game.notice}<button onClick={() => game.setNotice('')}>×</button></div>}
        {offline.updateAvailable && <div className="lab-notice">新版本已下载。{inProgress ? '本手结束后可更新。' : <button onClick={() => void offlineController.current?.acceptUpdate()}>应用更新</button>}</div>}
        {!loaded ? <div className="empty-state">正在读取本机练习记录…</div> : <>
          {(view === 'play' || view === 'review') && <div className="workspace-grid"><section className="table-column">
            {view === 'play' ? <>
              <div className="session-strip"><div><span className="live-dot" />单人练习 <span className="muted">/ 6-MAX NLHE</span></div><span>盲注 <b>5 / 10</b><i />起始 <b>100 BB</b></span></div>
              <PokerTable state={state} events={game.replay?.allEvents ?? []} />
              <ActionControls state={state} paused={game.paused} onResume={game.resume} onAction={act} onNext={() => { analysisId.current = ''; setInspection(undefined); game.nextHand(); }} />
              <div className="table-under"><span>✦ {heroTurn ? '轮到你行动。先判断牌力、价格和位置。' : !state ? '准备好了，就从第一手牌开始。' : state.phase === 'complete' ? '本手已结算，先复盘，再开始下一手。' : game.paused ? '牌局已暂停，先阅读这次行动的解析。' : `${state.actionOn == null ? '牌局进行中' : SEAT_NAMES[state.actionOn]} 正在思考…`}</span><button onClick={() => navigate('glossary')}>看不懂术语？打开词典 ↗</button></div>
              {state?.phase === 'complete' && <div className="hand-result"><span>本手净变化</span><strong className={state.players[0].stack - state.players[0].startingStack >= 0 ? 'positive' : 'negative'}>{state.players[0].stack - state.players[0].startingStack >= 0 ? '+' : ''}{number(state.players[0].stack - state.players[0].startingStack)} <small>筹码</small></strong><button className="button-secondary" onClick={() => { setSelectedHand(state.handId); navigate('review'); }}>逐步复盘这手牌 ↗</button></div>}
              <HandLog events={game.replay?.allEvents ?? []} />
            </> : <ReviewView hands={data.hands} selected={activeReview} onSelect={(id) => { setSelectedHand(id); analysisId.current = ''; setInspection(undefined); }} onInspect={inspect} />}
          </section><aside className="math-column"><MathPanel inspection={inspection} onHint={hint} canHint={Boolean(heroTurn && view === 'play')} /><section className="lab-panel range-panel"><div className="panel-heading"><span className="eyebrow">RANGE ASSUMPTIONS</span><span>↗</span></div><h3><Term id="range">对手范围 Range</Term></h3><p>每位仍在牌局中的对手使用相同示例范围，帮助你比较不同假设。</p><div className="range-tabs">{(Object.keys(RANGE_PRESETS) as RangePreset[]).map((p) => <button key={p} className={data.settings.preset === p ? 'selected' : ''} onClick={() => { settings({ preset: p }); if (heroTurn) { setInspection(undefined); analysisId.current = ''; } }}>{RANGE_PRESETS[p].label.split(' ')[0]}</button>)}</div><div className="range-meta"><strong>{RANGE_PRESETS[data.settings.preset].combinations}</strong><span>/ 1,326 个原始组合</span></div><p className="fine-print">示例假设，不代表机器人真实底牌或行动范围。复盘保留行动时的设置。</p><button className="text-button" onClick={() => setRangeOpen(true)}>查看具体手牌与组合 ↗</button></section><div className="math-note"><span>♣</span><p>一次输赢说明不了决策质量。<br />先看信息，再看计算，最后看结果。</p></div></aside></div>}
          {view === 'training' && <TrainingView progress={data.training} onProgress={(training) => game.replace({ ...data, training })} />}
          {view === 'glossary' && <GlossaryView />}
          {view === 'settings' && <SettingsView data={data} onSettings={settings} offline={offline} onRefresh={() => void offlineController.current?.refresh()} onImport={(next) => { game.replace(next); game.setNotice('备份已导入，当前手牌和练习进度已恢复。'); analysisId.current = ''; setInspection(undefined); }} onClear={async () => { await clearLabData(); game.replace(createEmptyData()); game.setNotice('本机练习记录已清除。'); }} onError={game.setError} />}
          <div className="progress-strip"><div><span className="stat-icon">↗</span><span>累计实战<strong>{number(data.totals.handsPlayed)} <small>手</small></strong></span></div><div><span className="stat-icon">◎</span><span>训练作答<strong>{number(attempts)} <small>次</small></strong></span></div><div><span className="stat-icon">✓</span><span>专项正确率<strong>{attempts ? `${Math.round(correct / attempts * 100)}%` : '—'}</strong></span></div><div className="progress-message">一点计算，<br /><strong>多一点把握。</strong></div></div>
        </>}
        <footer className="lab-footer"><span>♠ HOLD’EM LAB · 筹码实验室</span><span>基于 MIT 开源 Poker Mentor 改造 · 仅使用练习筹码</span></footer>
      </div>
    </main>
    <nav className="mobile-nav" aria-label="移动导航">{NAV.map((n) => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)}><span>{n.symbol}</span>{n.label}</button>)}<button className={view === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><span>⚙</span>离线设置</button></nav>
    {rangeOpen && <Modal title="示例范围 · 组合明细" onClose={() => setRangeOpen(false)}><RangeDetails preset={data.settings.preset} blocked={inspection ? [...inspection.snapshot.hero, ...inspection.snapshot.board] : state ? [...state.players[0].holeCards, ...state.board] : []} /></Modal>}
  </div>;
}

function Card({ card, small = false }: { card?: string; small?: boolean }) {
  const red = card?.[1] === 'h' || card?.[1] === 'd';
  return <span className={`playing-card ${small ? 'small' : ''} ${card ? red ? 'red' : 'black' : 'card-back'}`} aria-label={card ? `${card[0] === 'T' ? '10' : card[0]}${({ s: '黑桃', h: '红桃', d: '方块', c: '梅花' } as Record<string, string>)[card[1]]}` : '未公开的牌'}>{card ? <><b>{card[0] === 'T' ? '10' : card[0]}</b><span>{({ s: '♠', h: '♥', d: '♦', c: '♣' } as Record<string, string>)[card[1]]}</span></> : <i>♠</i>}</span>;
}

function PokerTable({ state, events, revealAll = false }: { state: GameState | null; events: HandEvent[]; revealAll?: boolean }) {
  const last = new Map<number, string>();
  const won = new Map<number, number>();
  let streetBet = 10;
  for (const event of events) {
    if (event.type === 'streetDealt') { last.clear(); streetBet = 0; }
    if (event.type === 'blindPosted') last.set(event.seatIndex, `${event.kind === 'small' ? 'SB' : 'BB'} ${event.amount}`);
    if (event.type === 'actionTaken') {
      last.set(event.seatIndex, event.allIn ? `All-in ${event.toStreetBet}` : event.action === 'fold' ? '弃牌 Fold' : event.action === 'check' ? '过牌 Check' : event.action === 'call' ? `Call ${event.amount}` : `${streetBet === 0 ? 'Bet' : 'Raise to'} ${event.toStreetBet}`);
      if (event.action === 'raise') streetBet = event.toStreetBet;
    }
    if (event.type === 'potAwarded') event.winners.forEach((w) => won.set(w.seatIndex, (won.get(w.seatIndex) ?? 0) + w.amount));
  }
  const heroMade = state && state.board.length >= 3 ? CATEGORY[analyzeHand([...state.players[0].holeCards, ...state.board]).category] : '';
  const showdown = state?.phase === 'complete' && state.players.filter((p) => !p.folded).length > 1;
  return <div className={`poker-scene ${!state ? 'idle-scene' : ''}`}><div className="felt-oval" /><div className="felt-inscription">HOLD’EM LAB <span>♠</span></div>
    <div className="community-area"><div className="street-label">{state ? STREETS[state.phase] : '你的下一次进步，从这一手开始'}</div><div className="community-cards">{Array.from({ length: 5 }, (_, i) => <Card key={i} card={state?.board[i]} />)}</div><div className="pot-display"><span className="chip-stack">◉</span><span>{state?.phase === 'complete' ? '底池已结算' : '底池 Pot'}<strong>{number(state && state.phase !== 'complete' ? totalPot(state) : 0)}</strong></span></div>{heroMade && <div className="hero-hand-label">你的牌型 · {heroMade}</div>}</div>
    {SEAT_NAMES.map((name, index) => {
      const p = state?.players[index];
      const visible = p && (index === 0 || revealAll || (showdown && !p.folded));
      const position = state ? positionOfSeat(state, index) : ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'][index];
      return <div key={index} className={`table-seat seat-${index} ${p?.folded ? 'folded' : ''} ${state?.actionOn === index ? 'acting' : ''} ${won.has(index) ? 'winner' : ''}`}><div className="seat-top"><span className={`seat-avatar avatar-${index}`}>{AVATARS[index]}</span><span className="seat-info"><b>{name}</b><span>{number(p?.stack ?? 1000)} <small>筹码</small></span></span>{(state ? state.buttonIndex === index : index === 0) && <span className="dealer-button" title="庄位 Dealer Button">D</span>}</div><div className="seat-cards"><Card card={visible ? p.holeCards[0] : undefined} small={index !== 0} /><Card card={visible ? p.holeCards[1] : undefined} small={index !== 0} /><span className="position-tag"><Term id={position.toLowerCase() as TermId}>{position}</Term></span></div><span className={`seat-action ${won.has(index) ? 'win-action' : ''}`}>{won.has(index) ? `赢得 +${number(won.get(index)!)}` : p?.folded ? '弃牌 Fold' : last.get(index) ?? (index === 0 ? '你的底牌 Hole Cards' : '等待行动')}</span></div>;
    })}
    <span className="scene-tag">6-MAX · NO-LIMIT HOLD’EM</span><span className="scene-blinds">5 / 10</span>
  </div>;
}

function ActionControls({ state, paused, onResume, onAction, onNext }: { state: GameState | null; paused: boolean; onResume: () => void; onAction: (a: PlayerAction) => void; onNext: () => void }) {
  const la = state?.actionOn === 0 ? legalActions(state) : null;
  const raise = la?.raise;
  const [amount, setAmount] = useState(0);
  const key = state ? `${state.handId}:${state.actionHistory.length}` : '';
  useEffect(() => { setAmount(raise?.minTo ?? 0); }, [key, raise?.minTo]);
  if (!state || state.phase === 'complete') return <div className="action-dock between-hands"><div><strong>{!state ? '坐下，开始练习' : '这一手，你学到了什么？'}</strong><small>{!state ? '100 BB 初始筹码 · 默认先判断再看解析' : '结算后不自动发牌，给思考留一点时间。'}</small></div><button className="button-primary" onClick={onNext}>{!state ? '开始第一手' : state.players[0].stack === 0 ? '领取筹码并继续' : '开始下一手'} <span>↗</span></button></div>;
  if (paused) return <div className="action-dock between-hands"><div><strong>行动已记录，先看看解析。</strong><small>牌局暂停，准备好后继续其他玩家的行动。</small></div><button className="button-primary" onClick={onResume}>继续牌局 →</button></div>;
  if (!la) return <div className="action-dock waiting-dock"><span className="thinking-dot" /><span>等待其他玩家行动…</span><small>你的筹码和本手进度会自动保存在本机。</small></div>;
  const hero = state.players[0];
  const clamp = (n: number) => Math.max(raise?.minTo ?? 0, Math.min(raise?.maxTo ?? 0, Math.round(n)));
  const selected = raise ? clamp(amount) : 0;
  const allInAction: PlayerAction | null = la.call?.allIn ? { type: 'call' } : raise ? { type: 'raise', amount: raise.maxTo } : null;
  const toCall = la.call?.amount ?? 0;
  return <div className="action-dock hero-action-dock"><div className="action-dock-head"><span><i className="live-dot" />轮到你行动 <small>YOUR ACTION</small></span><span className="dock-cards"><Card card={hero.holeCards[0]} small /><Card card={hero.holeCards[1]} small /></span><button className="text-button" onClick={() => document.getElementById('decision-hint')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>需要计算提示？ ↗</button></div>
    {raise && <><div className="bet-sizing"><label htmlFor="raise-amount">{state.currentBet === 0 ? '下注 Bet' : '加注至 Raise to'}</label><span className="bet-input"><input id="raise-amount" type="number" inputMode="numeric" min={raise.minTo} max={raise.maxTo} step="1" value={amount} onChange={(e) => setAmount(Number(e.target.value))} onBlur={() => setAmount(clamp(amount))} /><small>筹码</small></span><span className="added-chips">本次投入 <b>{number(Math.max(0, selected - hero.streetBet))}</b></span></div><input className="bet-slider" aria-label="调整下注或加注至的总额" type="range" min={raise.minTo} max={raise.maxTo} step="1" value={selected} onChange={(e) => setAmount(Number(e.target.value))} /><div className="bet-presets">{[{ label: '最小 Min', value: raise.minTo }, ...[1 / 3, 0.5, 2 / 3, 1].map((f, i) => ({ label: ['1/3 池', '1/2 池', '2/3 池', '满池 Pot'][i], value: clamp(state.currentBet + f * (totalPot(state) + toCall)) }))].map((p) => <button key={p.label} className={selected === p.value ? 'selected' : ''} onClick={() => setAmount(p.value)}>{p.label}</button>)}</div></>}
    <div className="action-buttons"><button className="action-fold" onClick={() => onAction({ type: 'fold' })}>弃牌 <small>Fold</small></button><button className="action-call" onClick={() => onAction({ type: la.check ? 'check' : 'call' })}>{la.check ? '过牌' : `跟注 ${number(toCall)}`}<small>{la.check ? 'Check' : la.call?.allIn ? 'Call All-in' : 'Call'}</small></button>{raise && <button className="action-raise" onClick={() => onAction({ type: 'raise', amount: selected })}>{selected === raise.maxTo ? `全下 ${number(selected)}` : state.currentBet === 0 ? `下注 ${number(selected)}` : `加注至 ${number(selected)}`}<small>{selected === raise.maxTo ? state.currentBet === 0 ? 'Bet All-in' : 'Raise All-in' : state.currentBet === 0 ? 'Bet' : 'Raise to'}</small></button>}{allInAction && !(raise && selected === raise.maxTo) && !la.call?.allIn && <button className="action-allin" onClick={() => onAction(allInAction)}>全下<small>All-in</small></button>}</div><p className="sizing-note">{raise ? `最小合法加注至 ${number(raise.minTo)}；快捷尺度按先跟注后的底池计算，超出范围会限制到合法金额。` : '当前没有再次加注权，或剩余筹码只够跟注。'}</p>
  </div>;
}

function MathPanel({ inspection, canHint, onHint }: { inspection?: Inspection; canHint: boolean; onHint: () => void }) {
  const result = inspection?.result;
  const choice = inspection?.action;
  const choiceLabel = !choice ? '' : choice.type === 'fold' ? '弃牌 Fold' : choice.type === 'check' ? '过牌 Check' : choice.type === 'call' ? '跟注 Call' : `${inspection!.snapshot.currentBet === 0 ? '下注 Bet' : '加注至 Raise to'} ${number(choice.amount!)}${choice.amount === inspection!.snapshot.legal.raise?.maxTo ? ' · All-in' : ''}`;
  return <section className="lab-panel math-panel" id="decision-hint"><div className="panel-heading"><span className="eyebrow">THE DECISION DESK</span><span className="panel-symbol">✧</span></div><h2>{inspection ? '把这一步，拆开看。' : '你会怎样行动？'}</h2><p className="panel-intro">{inspection ? `${STREETS[inspection.snapshot.phase]} · ${inspection.snapshot.position} · 行动时的信息与范围假设` : '答案先藏起来。给自己几秒，想一想你的依据。'}</p>{choiceLabel && <p className="chosen-action">你选择了 <strong>{choiceLabel}</strong>{choice?.type === 'raise' && <small>下列 EV 用于比较跟注备选方案，未估算此次加注的弃牌收益。</small>}</p>}
    {!inspection ? <><div className="hidden-math"><div><Term id="equity">底池权益 Equity</Term><b>?</b></div><div><Term id="potOdds">底池赔率 Pot Odds</Term><b>?</b></div><span>先思考，再揭晓</span></div><ol className="decision-checklist"><li><b>01</b><span>我现在是什么牌？<small>牌力、牌面与可能的补牌</small></span></li><li><b>02</b><span>继续需要付出多少？<small>跟注价格与所需权益</small></span></li><li><b>03</b><span>对手可能拿着什么？<small>位置、范围与有效筹码</small></span></li></ol><button className="hint-button" disabled={!canHint} onClick={onHint}>查看计算提示 <span>↗</span></button><p className="fine-print">{canHint ? '提示只使用你能看到的信息。行动后也可查看解析。' : '轮到你时可请求提示；复盘时可选择某次行动。'}</p></> : !result ? <div className="analysis-loading"><span className="thinking-dot" />正在本机计算范围权益…<small>计算在独立线程进行，你可以继续操作。</small></div> : result.status !== 'ok' ? <div className="lab-alert">{result.error ?? result.explanation}<button onClick={onHint} disabled={!canHint}>重新计算</button></div> : <>
      <div className="equity-large"><span><Term id="equity">底池权益 Equity</Term></span><strong>{percent(result.equity)}</strong><div className="equity-track"><i style={{ width: percent(result.equity) }} /></div><small>独赢 {percent(result.win)} <span>·</span> 平局 {percent(result.tie)}</small></div><div className="math-metrics"><div><span>所需权益</span><strong>{result.requiredEquity === null ? result.toCall ? result.pendingResponses && result.potModel === 'eligible-layers' ? '待后续行动' : '分池计算' : '无需跟注' : percent(result.requiredEquity)}</strong></div><div><span><Term id="ev">跟注 EV</Term></span><strong className={result.callEV >= 0 ? 'positive' : 'negative'}>{result.toCall ? `${result.callEV >= 0 ? '+' : ''}${result.callEV.toFixed(1)}` : '—'}</strong></div></div><div className="analysis-explanation">{result.explanation}</div><div className="math-formula"><small>当前投入 P / 本次跟注 C</small><code>{number(result.eligiblePot)} / {number(result.toCall)}</code><small>所需权益 = C ÷ (P + C)<br />{result.potModel === 'flat' ? 'EV = 权益 × (P + C) − C' : 'EV = Σ（各池权益 × 各池金额）− C'}<br />边池按资格分别计算</small></div><p className="fine-print">{result.rangeLabel}<br />{number(result.samples)} 个有效样本 · 95% 估算区间约 ±{(1.96 * result.standardError * 100).toFixed(1)} 个百分点。此误差不包含范围假设误差。</p>
    </>}
  </section>;
}

function HandLog({ events }: { events: HandEvent[] }) {
  let currentBet = 10;
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === 'streetDealt') { lines.push(`— ${STREETS[e.street]} —`); currentBet = 0; }
    if (e.type === 'blindPosted') lines.push(`${SEAT_NAMES[e.seatIndex]} · ${e.kind === 'small' ? '小盲 SB' : '大盲 BB'} ${e.amount}`);
    if (e.type === 'actionTaken') {
      const verb = e.action === 'fold' ? '弃牌 Fold' : e.action === 'check' ? '过牌 Check' : e.action === 'call' ? `跟注 Call ${e.amount}` : `${currentBet === 0 ? '下注 Bet' : '加注至 Raise to'} ${e.toStreetBet}`;
      lines.push(`${SEAT_NAMES[e.seatIndex]} · ${verb}${e.allIn ? ' · 全下 All-in' : ''}`);
      if (e.action === 'raise') currentBet = e.toStreetBet;
    }
    if (e.type === 'uncalledBetReturned') lines.push(`${SEAT_NAMES[e.seatIndex]} · 未被跟注的 ${e.amount} 筹码已退还`);
    if (e.type === 'potAwarded') lines.push(`${e.potIndex === 0 ? '主池 Main Pot' : '边池 Side Pot'} ${e.amount} → ${e.winners.map((w) => `${SEAT_NAMES[w.seatIndex]} +${w.amount}`).join(' / ')}`);
  }
  return <details className="hand-log-details"><summary><span>行动记录 <small>HAND HISTORY</small></span><span>{lines.length} 条记录 ＋</span></summary><div className="hand-log-lines">{lines.length ? lines.map((line, i) => <p key={i}>{line}</p>) : <p>开始一手牌后，盲注与每次行动会记录在这里。</p>}</div></details>;
}

function ReviewView({ hands, selected, onSelect, onInspect }: { hands: SavedLabHand[]; selected?: SavedLabHand; onSelect: (id: string) => void; onInspect: (snapshot: DecisionSnapshot, action?: PlayerAction) => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => { setStep(selected?.record.actions.length ?? 0); }, [selected?.record.handId]);
  const replay = useMemo(() => selected ? replayHand(selected.record) : null, [selected]);
  if (!selected || !replay) return <section className="lab-panel empty-state"><span>↺</span><h2>你的第一份牌谱，正在路上。</h2><p>完成一手实战后，这里会保留每次行动、结算和当时的计算假设。</p></section>;
  const index = Math.min(step, replay.steps.length - 1);
  const current = replay.steps[index];
  const visibleEvents = replay.steps.slice(0, index + 1).flatMap((s) => s.events);
  return <><div className="review-toolbar"><label htmlFor="hand-select">选择手牌</label><select id="hand-select" value={selected.record.handId} onChange={(e) => onSelect(e.target.value)}>{hands.map((h) => <option key={h.record.handId} value={h.record.handId}>{new Date(h.completedAt).toLocaleString('zh-CN')} · {h.net >= 0 ? '+' : ''}{h.net} 筹码</option>)}</select></div><PokerTable state={current.state} events={visibleEvents} revealAll /><section className="lab-panel replay-controls"><div className="replay-counter">行动 {index} / {replay.steps.length - 1}<span>{index ? SEAT_NAMES[current.seatIndex!] : '发牌与盲注'}</span></div><input aria-label="逐步回放行动" type="range" min={0} max={replay.steps.length - 1} value={index} onChange={(e) => setStep(Number(e.target.value))} /><div className="replay-buttons"><button className="button-secondary" disabled={index === 0} onClick={() => setStep(index - 1)}>← 上一步</button><button className="button-secondary" disabled={index === replay.steps.length - 1} onClick={() => setStep(index + 1)}>下一步 →</button></div><p className="fine-print">复盘可查看全部底牌；右侧解析仍只使用你行动前已知的信息，不使用对手底牌或后续公牌。</p></section><section className="lab-panel"><h3>你的行动决策 <small>DECISION REVIEW</small></h3><p className="muted">重看行动时冻结的范围假设；参考策略不作为唯一正确答案。</p><div className="decision-list">{selected.decisions?.length ? selected.decisions.map((s, i) => <button key={s.decisionId} onClick={() => { const actionIndex = Number(s.decisionId.split(':').at(-2)); if (Number.isInteger(actionIndex)) setStep(actionIndex); onInspect(s, selected.record.actions[actionIndex]); }}><span><b>{String(i + 1).padStart(2, '0')}</b>{STREETS[s.phase]}<small>{RANGE_PRESETS[s.preset].label} · {s.position}</small></span><span>查看解析 ↗</span></button>) : <p>本手未轮到你主动行动，或记录中没有保存决策快照。</p>}</div></section><HandLog events={visibleEvents} /></>;
}

function RangeDetails({ preset, blocked }: { preset: RangePreset; blocked: string[] }) {
  const combos = rangeCombos(preset, blocked);
  const grouped = new Map<string, number>();
  combos.forEach((combo) => grouped.set(handLabel(combo), (grouped.get(handLabel(combo)) ?? 0) + 1));
  return <><p>当前选择 <b>{RANGE_PRESETS[preset].label}</b>，原始 {RANGE_PRESETS[preset].combinations} 组合；排除你的底牌和当前公牌后剩 <b>{combos.length}</b> 组合。</p><p className="fine-print">每个具体两张牌组合等权；对子通常有 6 种、同花手牌 4 种、非同花手牌 12 种。阻断牌会减少组合数。s = suited 同花，o = offsuit 非同花。</p><div className="range-combo-grid">{[...grouped].map(([label, count]) => <span key={label}><b>{label}</b><small>{count} 组合</small></span>)}</div></>;
}

function SettingsView({ data, onSettings, offline, onRefresh, onImport, onClear, onError }: { data: LabData; onSettings: (s: Partial<LabData['settings']>) => void; offline: OfflineStatus; onRefresh: () => void; onImport: (d: LabData) => void; onClear: () => Promise<void>; onError: (s: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<LabData>();
  const [backupInfo, setBackupInfo] = useState('');
  const [limitedBackup, setLimitedBackup] = useState<ReturnType<typeof prepareBackup>>();
  function download(json?: string) {
    try {
      const prepared = json ? null : prepareBackup(data);
      if (prepared && prepared.omittedHands > 0) { setLimitedBackup(prepared); return; }
      const blob = new Blob([json ?? prepared!.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `holdem-lab-${new Date().toISOString().slice(0, 10)}.json`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setBackupInfo('备份已准备好，请保存到“文件”。');
    } catch (e) { onError(e instanceof Error ? e.message : '导出失败。'); }
  }
  return <div className="settings-grid"><section className="lab-panel"><span className="eyebrow">TAKE IT OFFLINE</span><h2>装进口袋里的训练场</h2><ol className="install-steps"><li><b>1</b><span>在 iPhone Safari 打开本页。<small>首次安装需要联网，目标支持 iOS 17 及以上。</small></span></li><li><b>2</b><span>分享 → 添加到主屏幕。<small>如有“作为网页 App 打开”，保持开启。</small></span></li><li><b>3</b><span>从主屏幕打开，等待离线检查完成。<small>显示“已可离线使用”后，开启飞行模式再次打开验证。</small></span></li></ol><div className={`offline-status-box ${offline.ready ? 'ready' : ''}`}><strong>{offline.ready ? '✓ 已可离线使用' : '○ 离线资源尚未确认完整'}</strong><p>{offline.error ?? (offline.ready ? '牌桌、练习、术语和计算资源已通过缓存完整性检查。' : '请保持联网，等候资源下载和检查。开发预览不提供离线安装。')}</p><button className="button-secondary" onClick={onRefresh}>重新检查资源</button></div><p className="fine-print">iOS 可能在空间不足或清理网站数据时移除缓存和记录。请定期导出备份；再次联网即可重新缓存游戏。iPhone 真机兼容性仍需按上述步骤实际验收。</p></section><section className="lab-panel"><span className="eyebrow">YOUR TABLE, YOUR PACE</span><h2>牌桌偏好</h2><label className="settings-row">机器人难度<select value={data.settings.difficulty} onChange={(e) => onSettings({ difficulty: e.target.value as LabData['settings']['difficulty'] })}><option value="easy">轻松 Easy</option><option value="medium">标准 Medium</option><option value="hard">挑战 Hard</option></select></label><label className="settings-row">行动速度<select value={data.settings.speed} onChange={(e) => onSettings({ speed: e.target.value as LabData['settings']['speed'] })}><option value="slow">慢速 Slow</option><option value="normal">正常 Normal</option><option value="fast">快速 Fast</option></select></label><p className="fine-print">机器人采用有风格差异的启发式策略，不是 GTO 求解器。默认先判断再看提示，设置不会改变这一练习方式。</p><div className="settings-divider" /><span className="eyebrow">LOCAL DATA & BACKUP</span><h2>进度只属于这台设备</h2><p>保存最近 1,000 手牌、累计统计、当前牌局和专项进度，不上传训练记录。</p><div className="backup-buttons"><button className="button-primary" onClick={() => download()}>导出 JSON 备份 ↗</button><button className="button-secondary" onClick={() => file.current?.click()}>导入备份</button></div><input ref={file} className="visually-hidden" type="file" accept="application/json,.json" onChange={(e) => { const chosen = e.target.files?.[0]; if (!chosen) return; if (chosen.size > MAX_BACKUP_BYTES) { onError('备份超过 10 MB，未导入。'); e.target.value = ''; return; } void chosen.text().then((json) => setPendingImport(parseBackup(json))).catch((error: unknown) => onError(error instanceof Error ? error.message : '导入失败。')); e.target.value = ''; }} /><p role="status" className="fine-print">{backupInfo || '导入前会验证版本、字段和手牌重放，并要求你确认替换本机记录。'}</p><button className="danger-link" onClick={() => setConfirm(true)}>清除本机练习记录</button></section>{pendingImport && <Modal title="替换本机练习记录？" onClose={() => setPendingImport(undefined)}><p>备份已通过校验，包含 {pendingImport.hands.length} 手牌、累计 {pendingImport.totals.handsPlayed} 手实战。导入会替换当前牌局、训练进度与设置。</p><p>建议先导出当前记录。</p><button className="button-primary" onClick={() => { onImport(pendingImport); setPendingImport(undefined); }}>确认导入并替换</button></Modal>}{limitedBackup && <Modal title="导出最近的手牌备份？" onClose={() => setLimitedBackup(undefined)}><p>完整备份超过 10 MB。本次将导出最近 {limitedBackup.includedHands} 手牌，省略最旧的 {limitedBackup.omittedHands} 手牌；累计统计、当前牌局、训练和设置全部保留。本机原始记录不变。</p><button className="button-primary" onClick={() => { download(limitedBackup.json); setLimitedBackup(undefined); }}>确认导出这份备份</button></Modal>}{confirm && <Modal title="清除本机记录？" onClose={() => setConfirm(false)}><p>当前牌局、保存的牌谱、累计统计和错题都会清除。离线游戏资源会保留。</p><button className="button-danger" onClick={() => { void onClear().then(() => setConfirm(false)).catch((e: unknown) => onError(e instanceof Error ? e.message : '清除失败。')); }}>确认清除记录</button></Modal>}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; close.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}><section className="lab-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}><div className="modal-heading"><h2>{title}</h2><button ref={close} onClick={onClose} aria-label="关闭弹窗">×</button></div>{children}</section></div>;
}
