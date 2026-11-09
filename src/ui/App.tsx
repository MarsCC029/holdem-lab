import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { tableController, BUY_IN } from '../game/tableController';
import { PERSONALITIES, type Difficulty } from '../bots/personalities';
import type { GameSpeed } from '../store/settingsStore';
import { PokerTable } from './table/PokerTable';
import { ActionBar } from './table/ActionBar';
import { CoachPanel } from './coach/CoachPanel';
import { ReviewPanel } from './analysis/ReviewPanel';
import { LessonsView } from './lessons/LessonsView';
import { StatsView } from './stats/StatsView';
import { ReplayViewer } from './analysis/ReplayViewer';
import { HandSummaryModal } from './analysis/HandSummaryModal';
import { useUiStore, type AppView } from '../store/uiStore';
import './App.css';

export function App() {
  const status = useGameStore((s) => s.status);
  const view = useUiStore((s) => s.view);

  return (
    <div className="app">
      <Header />
      {/* the table stays mounted so a running hand survives tab switches */}
      <div className="main-row" style={{ display: view === 'play' ? 'flex' : 'none' }}>
        <div className="play-column">
          <PokerTable />
          <CoachPanel />
          <ReviewPanel />
          <ActionBar />
        </div>
        <HandLog />
      </div>
      {view === 'lessons' && <LessonsView />}
      {view === 'stats' && <StatsView />}
      <HandSummaryModal />
      <ReplayViewer />
      {status === 'idle' && view === 'play' && <WelcomeOverlay />}
      {status === 'heroBusted' && view === 'play' && <BustedOverlay />}
    </div>
  );
}

function Header() {
  const handNumber = useGameStore((s) => s.handNumber);
  const difficulty = useSettingsStore((s) => s.difficulty);
  const speed = useSettingsStore((s) => s.speed);
  const coachEnabled = useSettingsStore((s) => s.coachEnabled);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setDifficulty = useSettingsStore((s) => s.setDifficulty);
  const setSpeed = useSettingsStore((s) => s.setSpeed);
  const setCoachEnabled = useSettingsStore((s) => s.setCoachEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-suit">♠</span>
        <h1>Poker Mentor</h1>
      </div>
      <NavTabs />
      <div className="header-meta">
        {handNumber > 0 && <span className="meta-item">Hand #{handNumber}</span>}
        <span className="meta-item">Blinds 5 / 10</span>
      </div>
      <div className="header-controls">
        <Segmented
          label="Bots"
          value={difficulty}
          options={['easy', 'medium', 'hard'] as Difficulty[]}
          onChange={setDifficulty}
        />
        <Segmented
          label="Speed"
          value={speed}
          options={['slow', 'normal', 'fast'] as GameSpeed[]}
          onChange={setSpeed}
        />
        <Segmented
          label="Coach"
          value={coachEnabled ? 'on' : 'off'}
          options={['on', 'off']}
          onChange={(v) => setCoachEnabled(v === 'on')}
        />
        <button
          className="sound-toggle"
          title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </header>
  );
}

function NavTabs() {
  const view = useUiStore((s) => s.view);
  const go = useUiStore((s) => s.go);
  const tabs: { id: AppView; label: string }[] = [
    { id: 'play', label: 'Table' },
    { id: 'lessons', label: 'Lessons' },
    { id: 'stats', label: 'Stats' },
  ];
  return (
    <nav className="nav-tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`nav-tab${view === t.id ? ' nav-tab--active' : ''}`}
          onClick={() => go(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      <span className="segmented-label">{label}</span>
      <div className="segmented-options">
        {options.map((opt) => (
          <button
            key={opt}
            className={`segmented-opt${value === opt ? ' segmented-opt--active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function HandLog() {
  const log = useGameStore((s) => s.log);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log.length]);

  return (
    <aside className="hand-log">
      <div className="hand-log-title">Hand Log</div>
      <div className="hand-log-body">
        {log.map((line, i) => (
          <div key={i} className={logLineClass(line)}>
            {line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </aside>
  );
}

function logLineClass(line: string): string {
  if (line.startsWith('—')) return 'log-line log-line--hand';
  if (/^(Flop|Turn|River):/.test(line)) return 'log-line log-line--street';
  if (/wins \d/.test(line)) return 'log-line log-line--win';
  return 'log-line';
}

function WelcomeOverlay() {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="overlay-kicker">A private table awaits</div>
        <h2 className="overlay-title">Poker Mentor</h2>
        <p className="overlay-sub">
          Six-max No-Limit Hold&rsquo;em against five very different opponents.
          Learn the game hand by hand — coaching arrives as you play.
        </p>
        <div className="lineup">
          {Object.values(PERSONALITIES).map((p) => (
            <div key={p.id} className="lineup-row" title={p.tagline}>
              <span className="lineup-avatar">{p.avatar}</span>
              <span className="lineup-name">{p.name}</span>
              <span className="lineup-tag">{p.tagline}</span>
            </div>
          ))}
        </div>
        <button className="cta" onClick={() => tableController.startSession()}>
          Take your seat · {BUY_IN.toLocaleString()} chips
        </button>
      </div>
    </div>
  );
}

function BustedOverlay() {
  return (
    <div className="overlay">
      <div className="overlay-card overlay-card--narrow">
        <h2 className="overlay-title overlay-title--bust">Felted.</h2>
        <p className="overlay-sub">
          It happens to everyone. Review what went wrong, then get back in there.
        </p>
        <button className="cta" onClick={() => tableController.rebuyHero()}>
          Buy back in · {BUY_IN.toLocaleString()} chips
        </button>
      </div>
    </div>
  );
}
