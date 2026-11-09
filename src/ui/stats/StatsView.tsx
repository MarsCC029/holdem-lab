import { useEffect, useState } from 'react';
import { listHands, type StoredHand } from '../../stats/db';
import '../analysis/ReplayViewer.css';
import { computeStats, type AggregateStats } from '../../stats/statsEngine';
import { detectLeaks } from '../../stats/leakDetection';
import { lessonById } from '../../lessons/curriculum';
import { useUiStore } from '../../store/uiStore';
import { formatChips } from '../../game/format';
import type { MistakeCategory } from '../../analysis/gradeHand';
import './Stats.css';

const CATEGORY_LABEL: Record<MistakeCategory, string> = {
  CALL_WITHOUT_ODDS: 'Called without odds',
  LOOSE_PREFLOP: 'Loose preflop',
  MISSED_VALUE: 'Missed value',
  UNNECESSARY_FOLD: 'Folded profit',
  FOLD_WHEN_FREE: 'Folded for free',
  WILD_RAISE: 'Wild raises',
};

export function StatsView() {
  const [hands, setHands] = useState<StoredHand[] | null>(null);
  useEffect(() => {
    let live = true;
    void listHands(1000).then((h) => {
      if (live) setHands(h);
    });
    return () => {
      live = false;
    };
  }, []);

  if (hands === null) {
    return <div className="stats-view stats-empty">Loading your history…</div>;
  }
  if (hands.length === 0) {
    return (
      <div className="stats-view stats-empty">
        <h2>No hands yet</h2>
        <p>Play a session at the table — every hand you finish lands here, graded.</p>
      </div>
    );
  }
  const stats = computeStats(hands);
  return <Dashboard stats={stats} hands={hands} />;
}

function Dashboard({ stats, hands }: { stats: AggregateStats; hands: StoredHand[] }) {
  const go = useUiStore((s) => s.go);
  const openReplay = useUiStore((s) => s.openReplay);
  const leaks = detectLeaks(stats);
  const mistakes = Object.entries(stats.mistakeCounts) as [MistakeCategory, number][];
  const maxMistake = Math.max(1, ...mistakes.map(([, n]) => n));

  return (
    <div className="stats-view">
      <h2>Your Game, Measured</h2>

      <div className="stat-cards">
        <StatCard label="Hands played" value={String(stats.hands)} />
        <StatCard
          label="Net chips"
          value={`${stats.netChips >= 0 ? '+' : ''}${formatChips(stats.netChips)}`}
          tone={stats.netChips >= 0 ? 'good' : 'bad'}
        />
        <StatCard
          label="BB / 100 hands"
          value={`${stats.bbPer100 >= 0 ? '+' : ''}${stats.bbPer100.toFixed(1)}`}
          tone={stats.bbPer100 >= 0 ? 'good' : 'bad'}
          hint="Win rate in big blinds per 100 hands — the standard poker yardstick."
        />
        <StatCard
          label="VPIP"
          value={`${Math.round(stats.vpip * 100)}%`}
          hint="How often you voluntarily enter the pot. Solid 6-max play: 20–28%."
          tone={stats.vpip >= 0.15 && stats.vpip <= 0.32 ? 'good' : 'warn'}
        />
        <StatCard
          label="PFR"
          value={`${Math.round(stats.pfr * 100)}%`}
          hint="How often you raise preflop. Should be most of your VPIP."
        />
        <StatCard
          label="Good decisions"
          value={`${Math.round(stats.goodRate * 100)}%`}
          hint="Share of your decisions the coach fully agreed with."
          tone={stats.goodRate >= 0.7 ? 'good' : 'warn'}
        />
      </div>

      <div className="stats-columns">
        <div className="stats-block">
          <h3>Bankroll</h3>
          <Sparkline series={stats.bankrollSeries} />
        </div>

        <div className="stats-block">
          <h3>Where chips leak</h3>
          {mistakes.length === 0 ? (
            <p className="stats-quiet">No flagged mistakes yet. The coach is watching…</p>
          ) : (
            <div className="mistake-bars">
              {mistakes
                .sort((a, b) => b[1] - a[1])
                .map(([cat, n]) => (
                  <div key={cat} className="mistake-row">
                    <span className="mistake-label">{CATEGORY_LABEL[cat]}</span>
                    <span className="mistake-bar">
                      <span className="mistake-fill" style={{ width: `${(n / maxMistake) * 100}%` }} />
                    </span>
                    <span className="mistake-count">{n}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="stats-block">
        <h3>Recent hands</h3>
        <div className="replay-open-list">
          {hands.slice(0, 12).map((h) => (
            <button key={h.handId} className="replay-hand-row" onClick={() => openReplay(h)}>
              <span className="replay-hand-id">#{h.handId.split('-').pop()}</span>
              <span className={h.net >= 0 ? 'replay-hand-net--win' : 'replay-hand-net--loss'}>
                {h.net >= 0 ? '+' : ''}
                {formatChips(h.net)}
              </span>
              <span className="replay-hand-summary">{h.grade.summary}</span>
              <span>▶</span>
            </button>
          ))}
        </div>
      </div>

      <div className="stats-block">
        <h3>Leak report</h3>
        {leaks.length === 0 ? (
          <p className="stats-quiet">
            {stats.hands < 40
              ? `Keep playing — leak detection unlocks with a bigger sample (${stats.hands}/40 hands).`
              : 'No leaks detected at this sample size. Keep it up.'}
          </p>
        ) : (
          <div className="leak-list">
            {leaks.map((leak) => {
              const lesson = lessonById(leak.lessonId);
              return (
                <div key={leak.id} className={`leak leak--${leak.severity}`}>
                  <div className="leak-text">
                    <span className="leak-title">{leak.title}</span>
                    <span className="leak-detail">{leak.detail}</span>
                  </div>
                  {lesson && (
                    <button className="leak-study" onClick={() => go('lessons', lesson.id)}>
                      Study: {lesson.icon} {lesson.title}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'bad' | 'warn';
}) {
  return (
    <div className={`stat-card${tone ? ` stat-card--${tone}` : ''}`} title={hint}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Sparkline({ series }: { series: number[] }) {
  const w = 420;
  const h = 110;
  if (series.length < 2) {
    return <p className="stats-quiet">Play a few more hands to draw the curve.</p>;
  }
  const min = Math.min(0, ...series);
  const max = Math.max(0, ...series);
  const range = Math.max(1, max - min);
  const x = (i: number) => (i / (series.length - 1)) * (w - 8) + 4;
  const y = (v: number) => h - 8 - ((v - min) / range) * (h - 16);
  const points = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const zeroY = y(0);
  const up = series[series.length - 1] >= 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" preserveAspectRatio="none">
      <line x1="0" x2={w} y1={zeroY} y2={zeroY} className="sparkline-zero" />
      <polyline points={points} className={`sparkline-line ${up ? 'sparkline-line--up' : 'sparkline-line--down'}`} />
    </svg>
  );
}
