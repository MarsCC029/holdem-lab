import { useEffect, useState } from 'react';
import type { Drill, Lesson } from '../../lessons/types';
import { LESSONS, lessonById } from '../../lessons/curriculum';
import { useProgressStore } from '../../store/progressStore';
import { useUiStore } from '../../store/uiStore';
import { CardView } from '../table/CardView';
import { formatChips } from '../../game/format';
import './Lessons.css';

export function LessonsView() {
  const openLessonId = useUiStore((s) => s.openLessonId);
  const clearOpenLesson = useUiStore((s) => s.clearOpenLesson);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (openLessonId) {
      setActiveId(openLessonId);
      clearOpenLesson();
    }
  }, [openLessonId, clearOpenLesson]);

  const active = activeId ? lessonById(activeId) : null;
  if (active) {
    return <LessonDetail lesson={active} onBack={() => setActiveId(null)} />;
  }
  return <LessonList onOpen={setActiveId} />;
}

function LessonList({ onOpen }: { onOpen: (id: string) => void }) {
  const results = useProgressStore((s) => s.results);
  return (
    <div className="lessons-view">
      <div className="lessons-intro">
        <h2>The Curriculum</h2>
        <p>
          Eight short lessons, each with drills. Work top to bottom — every lesson feeds the next,
          and the table coach reinforces all of it while you play.
        </p>
      </div>
      <div className="lesson-grid">
        {LESSONS.map((lesson, i) => {
          const r = results[lesson.id];
          return (
            <button key={lesson.id} className="lesson-card" onClick={() => onOpen(lesson.id)}>
              <span className="lesson-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="lesson-icon">{lesson.icon}</span>
              <span className="lesson-card-body">
                <span className="lesson-title">{lesson.title}</span>
                <span className="lesson-blurb">{lesson.blurb}</span>
              </span>
              {r?.passed ? (
                <span className="lesson-badge lesson-badge--done">
                  ✓ {r.score}/{r.total}
                </span>
              ) : (
                <span className="lesson-badge">Start</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LessonDetail({ lesson, onBack }: { lesson: Lesson; onBack: () => void }) {
  const [drilling, setDrilling] = useState(false);
  return (
    <div className="lessons-view">
      <button className="lesson-back" onClick={onBack}>
        ← All lessons
      </button>
      {!drilling ? (
        <div className="lesson-detail">
          <h2>
            {lesson.icon} {lesson.title}
          </h2>
          {lesson.sections.map((s) => (
            <section key={s.heading}>
              <h3>{s.heading}</h3>
              {s.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </section>
          ))}
          <button className="cta" onClick={() => setDrilling(true)}>
            Try the drills · {lesson.drills.length} questions
          </button>
        </div>
      ) : (
        <DrillRunner lesson={lesson} onDone={() => setDrilling(false)} />
      )}
    </div>
  );
}

function DrillRunner({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const recordResult = useProgressStore((s) => s.recordResult);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const drill = lesson.drills[idx];
  const total = lesson.drills.length;

  const correctIdx = (d: Drill): number => {
    switch (d.kind) {
      case 'mcq':
        return d.answerIdx;
      case 'whichHandWins':
        return d.answerIdx; // -1 = split pot option (rendered last)
      case 'scenario':
        return d.options.indexOf(d.correctAction);
    }
  };

  if (finished) {
    const passed = score / total >= lesson.passScore;
    return (
      <div className="drill-done">
        <h2>{passed ? '🏆 Passed!' : 'Not quite.'}</h2>
        <p className="drill-score">
          {score} / {total} correct
        </p>
        <p>
          {passed
            ? 'Nice work — this is now in your toolkit. The coach will hold you to it at the table.'
            : `You need ${Math.ceil(lesson.passScore * total)} to pass. Skim the lesson again — the drills will be waiting.`}
        </p>
        <div className="drill-done-actions">
          <button
            className="cta"
            onClick={() => {
              recordResult(lesson.id, score, total, passed);
              onDone();
            }}
          >
            {passed ? 'Finish' : 'Back to the lesson'}
          </button>
        </div>
      </div>
    );
  }

  const answer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const target = correctIdx(drill);
    const isSplit = drill.kind === 'whichHandWins' && drill.answerIdx === -1;
    const correct = isSplit ? i === drill.hands.length : i === target;
    if (correct) setScore((s) => s + 1);
  };

  const next = () => {
    setPicked(null);
    if (idx + 1 >= total) setFinished(true);
    else setIdx(idx + 1);
  };

  const targetIdx =
    drill.kind === 'whichHandWins' && drill.answerIdx === -1 ? drill.hands.length : correctIdx(drill);

  return (
    <div className="drill">
      <div className="drill-progress">
        Question {idx + 1} of {total} · {score} correct
      </div>

      {drill.kind === 'mcq' && (
        <>
          <h3 className="drill-prompt">{drill.prompt}</h3>
          <div className="drill-options">
            {drill.options.map((opt, i) => (
              <button key={i} className={optClass(i, picked, targetIdx)} onClick={() => answer(i)}>
                {opt}
              </button>
            ))}
          </div>
        </>
      )}

      {drill.kind === 'whichHandWins' && (
        <>
          <h3 className="drill-prompt">{drill.prompt ?? 'Which hand wins at showdown?'}</h3>
          <div className="drill-board">
            {drill.board.map((c, i) => (
              <CardView key={c} card={c} size="board" dealIndex={i} />
            ))}
          </div>
          <div className="drill-options drill-options--hands">
            {drill.hands.map((h, i) => (
              <button key={i} className={optClass(i, picked, targetIdx)} onClick={() => answer(i)}>
                <span className="drill-hand-cards">
                  <CardView card={h.cards[0]} size="mini" />
                  <CardView card={h.cards[1]} size="mini" />
                </span>
                {h.label}
              </button>
            ))}
            <button className={optClass(drill.hands.length, picked, targetIdx)} onClick={() => answer(drill.hands.length)}>
              Split pot
            </button>
          </div>
        </>
      )}

      {drill.kind === 'scenario' && (
        <>
          <h3 className="drill-prompt">{drill.prompt}</h3>
          <div className="drill-scenario">
            <div className="drill-scenario-cards">
              <span className="drill-label">Your hand</span>
              <span className="drill-hand-cards">
                <CardView card={drill.hero[0]} size="hole" />
                <CardView card={drill.hero[1]} size="hole" />
              </span>
            </div>
            {drill.board.length > 0 && (
              <div className="drill-scenario-cards">
                <span className="drill-label">Board</span>
                <span className="drill-hand-cards">
                  {drill.board.map((c, i) => (
                    <CardView key={c} card={c} size="hole" dealIndex={i} />
                  ))}
                </span>
              </div>
            )}
            <div className="drill-scenario-facts">
              <span>Position: {drill.position}</span>
              <span>Pot: {formatChips(drill.pot)}</span>
              {drill.toCall > 0 && <span>To call: {formatChips(drill.toCall)}</span>}
            </div>
          </div>
          <div className="drill-options">
            {drill.options.map((opt, i) => (
              <button key={i} className={optClass(i, picked, targetIdx)} onClick={() => answer(i)}>
                {opt.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}

      {picked !== null && (
        <div className={`drill-explain ${picked === targetIdx ? 'drill-explain--right' : 'drill-explain--wrong'}`}>
          <b>{picked === targetIdx ? 'Correct.' : 'Not this time.'}</b> {drill.explain}
          <button className="drill-next" onClick={next}>
            {idx + 1 >= total ? 'See results →' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  );
}

function optClass(i: number, picked: number | null, targetIdx: number): string {
  const base = 'drill-opt';
  if (picked === null) return base;
  if (i === targetIdx) return `${base} drill-opt--correct`;
  if (i === picked) return `${base} drill-opt--wrong`;
  return `${base} drill-opt--dim`;
}
