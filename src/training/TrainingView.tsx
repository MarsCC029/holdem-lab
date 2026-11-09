import { useState } from 'react';
import type { FormEvent } from 'react';
import { Term } from '../terminology/Term';
import { cardLabel } from './math';
import { categories, isAnswerCorrect, trainingQuestions } from './questions';
import type { CategoryId } from './questions';
import { validateTrainingProgress } from './progress';
import type { TrainingProgress } from './progress';
import './training.css';

export interface TrainingViewProps {
  progress?: TrainingProgress;
  onProgress?: (next: TrainingProgress) => void;
}
const STORAGE_KEY = 'holdem-lab-training-v1';
function readProgress(): TrainingProgress {
  try { return validateTrainingProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')); } catch { return {}; }
}
function shuffled(ids: string[]): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const other = Math.floor(Math.random() * (i + 1));
    [result[i], result[other]] = [result[other], result[i]];
  }
  return result;
}
function Cards({ cards }: { cards: string[] }) {
  return <span className="lab-training-cards">{cards.map(card => <span className={`lab-training-card ${/[hd]$/.test(card) ? 'red' : ''}`} key={card}>{cardLabel(card)}</span>)}</span>;
}

function LearningReference() {
  return <details className="lab-training-reference"><summary>先学会怎么算 · 六个公式与例子 <span>展开学习卡</span></summary>
    <div className="lab-training-reference-grid">
      <article><h3>01 · 补牌与概率</h3><p><Term id="outs" /> 先去重；一张命中率 = outs / 未知牌数。两张至少中一次 = 1 − 两张都不中的概率。</p><code>9 outs：1 − 38/47 × 37/46 ≈ 34.97%</code><p><Term id="rule24" /> 只是近似。完成听牌的概率不等于 <Term id="equity" />；河牌后没有待发牌。</p></article>
      <article><h3>02 · 底池赔率</h3><p><Term id="potOdds" />：设 P 是当前池，已包含对手的下注；C 是现在还要补的跟注额。</p><code>最低权益 = C / (P + C)</code><p>当前池 150，补 50：50 / 200 = 25%。仅用于无后续下注、无抽水等假设。</p></article>
      <article><h3>03 · 跟注期望值</h3><p><Term id="ev" />：题目给定权益 E；相对现在弃牌，计算这次跟注的平均增量。</p><code>EV(call) = E × (P + C) − C</code><p>池 150、补 50、权益 30%：EV = +10。正 EV 不保证单次获胜。</p></article>
      <article><h3>04 · 纯诈唬门槛</h3><p><Term id="bluff" /> 被跟必输，只考虑对手跟或弃。P 是下注前的池，B 是你的新下注。</p><code>盈亏平衡弃牌率 = B / (P + B)</code><p>用 50 争 100：需弃牌率 33.33%。<Term id="semiBluff" /> 不能直接套这个零权益模型。</p></article>
      <article><h3>05 · 下注与加注</h3><p><Term id="bet" /> 是首次下注；<Term id="raise" /> 是本街总额。最小加注看最近一次完整加注增量。</p><code>20 → 60：增量 40；再加至少到 100</code><p>已投 20，加注到 100 需再投入 80。<Term id="shortAllIn" /> 不会自动重开已行动者的加注权。</p></article>
      <article><h3>06 · 范围与权益</h3><p><Term id="range" /> 不只是猜一手牌。题库范围题固定为河牌单挑、精确花色、等权组合。</p><code>权益 = (赢的组合 + 平局组合 / 2) / 总组合</code><p>一赢、一平、一输：权益 50%。实战结论取决于范围假设；这些题不提供 GTO 解。</p></article>
    </div>
  </details>;
}

export function TrainingView({ progress, onProgress }: TrainingViewProps = {}) {
  const [localProgress, setLocalProgress] = useState<TrainingProgress>(readProgress);
  const currentProgress = progress ?? localProgress;
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [wrongOnly, setWrongOnly] = useState(false);
  const [sessionIds, setSessionIds] = useState(() => shuffled(trainingQuestions.map(question => question.id)));
  const [index, setIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; submitted: number } | null>(null);
  const [inputError, setInputError] = useState('');
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionAnswered, setSessionAnswered] = useState(0);
  const question = trainingQuestions.find(item => item.id === sessionIds[index]);
  const attemptedCount = Object.values(currentProgress).filter(item => item.attempts > 0).length;
  const masteredCount = Object.values(currentProgress).filter(item => item.lastCorrect).length;
  const wrongCount = Object.values(currentProgress).filter(item => !item.lastCorrect && item.attempts > 0).length;

  function saveProgress(next: TrainingProgress) {
    setLocalProgress(next);
    if (onProgress) onProgress(next);
    if (progress === undefined) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Practice remains usable when storage is unavailable. */ }
    }
  }
  function resetAnswer() { setAnswerText(''); setFeedback(null); setInputError(''); }
  function startSession(nextCategory = category, nextWrongOnly = wrongOnly) {
    const ids = trainingQuestions.filter(item => (nextCategory === 'all' || item.category === nextCategory)
      && (!nextWrongOnly || (currentProgress[item.id]?.attempts > 0 && !currentProgress[item.id]?.lastCorrect))).map(item => item.id);
    setCategory(nextCategory); setWrongOnly(nextWrongOnly); setSessionIds(shuffled(ids));
    setIndex(0); setSessionCorrect(0); setSessionAnswered(0); resetAnswer();
  }
  function submitAnswer(event: FormEvent) {
    event.preventDefault();
    if (!question || feedback) return;
    const normalized = answerText.trim().replace(/%$/, '').trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
      setInputError('请输入一个数字；百分数直接填 25，负收益可填 -10。'); return;
    }
    const submitted = Number(normalized);
    const correct = isAnswerCorrect(question, submitted);
    const previous = currentProgress[question.id];
    saveProgress({ ...currentProgress, [question.id]: { attempts: (previous?.attempts ?? 0) + 1, correct: (previous?.correct ?? 0) + (correct ? 1 : 0), lastCorrect: correct } });
    setFeedback({ correct, submitted }); setInputError('');
    setSessionAnswered(count => count + 1); if (correct) setSessionCorrect(count => count + 1);
  }

  return <section className="lab-training">
    <div className="lab-training-heading"><div><span className="lab-section-eyebrow">MAKE THE MATH A HABIT</span><h2>把每一步，算清楚。</h2>
      <p>60 道确定答案的练习，练补牌、赔率、EV 和下注尺度。先自己计算，再看过程。</p></div>
      <div className="lab-training-total"><strong>{masteredCount}<span>/60</span></strong><small>最近一次答对</small></div></div>
    <LearningReference />
    <div className="lab-training-category-grid">
      {categories.map(item => {
        const count = trainingQuestions.filter(q => q.category === item.id && currentProgress[q.id]?.lastCorrect).length;
        return <button className={`lab-training-category ${category === item.id ? 'active' : ''}`} type="button" key={item.id} onClick={() => startSession(item.id, wrongOnly)} aria-pressed={category === item.id}>
          <span>{item.english}</span><strong>{item.name}</strong><small>{item.description}</small><em>{count} / 10 已掌握</em>
        </button>;
      })}
    </div>
    <div className="lab-training-toolbar"><div><button type="button" className={category === 'all' ? 'active' : ''} onClick={() => startSession('all', wrongOnly)}>综合练习</button>
      <button type="button" className={wrongOnly ? 'active' : ''} aria-pressed={wrongOnly} onClick={() => startSession(category, !wrongOnly)}>只练错题 <span>{wrongCount}</span></button>
      <button type="button" onClick={() => startSession()}>↻ 重新随机</button></div><span>已练 {attemptedCount} / 60 题</span></div>
    {question ? <article className="lab-training-question" key={question.id}>
      <div className="lab-training-question-meta"><span>{categories.find(item => item.id === question.category)?.name}</span><span>本轮 {index + 1} / {sessionIds.length}</span></div>
      <div className="lab-training-track"><span style={{ width: `${index / sessionIds.length * 100}%` }} /></div>
      <h3>{question.title}</h3><p className="lab-training-prompt">{question.prompt}</p>
      {question.hero && <div className="lab-training-card-row"><span>你的底牌</span><Cards cards={question.hero} /></div>}
      {question.board && <div className="lab-training-card-row"><span>当前公牌</span><Cards cards={question.board} /></div>}
      {question.range && <div className="lab-training-range"><strong>对手等权范围 · 只持其中一手</strong><div>{question.range.map((hand, handIndex) => <span className="lab-training-range-hand" key={handIndex}><Cards cards={hand} /><small>1/{question.range!.length}</small></span>)}</div></div>}
      <form className="lab-training-answer-form" onSubmit={submitAnswer}>
        <label htmlFor="training-answer">你的答案 <span>{question.unit === '%' ? '填百分数，例如 25；允许 ±1 个百分点' : question.tolerance === 0 ? '精确值' : '允许 ±1 筹码误差'}</span></label>
        <div><input id="training-answer" name="answer" type="text" inputMode="decimal" autoComplete="off" value={answerText} onChange={event => setAnswerText(event.target.value)} placeholder={question.unit === '%' ? '例如 25' : '输入数字'} disabled={feedback !== null} aria-describedby={inputError ? 'training-input-error' : undefined} />
          <span>{question.unit}</span><button type="submit" disabled={feedback !== null}>检查答案 →</button></div>
        {inputError && <p id="training-input-error" className="lab-training-input-error" role="alert">{inputError}</p>}
      </form>
      {feedback && <div className={`lab-training-feedback ${feedback.correct ? 'correct' : 'incorrect'}`} role="status">
        <h4>{feedback.correct ? '✓ 计算正确' : '再看一次计算过程'}</h4>
        <p>你的答案：{feedback.submitted}{question.unit} · 参考答案：{Number(question.answer.toFixed(2))}{question.unit}</p>
        <div className="lab-training-formula">{question.formula}</div><p>{question.explanation}</p>
        <div className="lab-training-feedback-actions">{!feedback.correct && <button type="button" onClick={resetAnswer}>再试本题</button>}
          <button type="button" onClick={() => { setIndex(value => value + 1); resetAnswer(); }}>{index + 1 === sessionIds.length ? '完成本轮' : '下一题 →'}</button></div>
      </div>}
    </article> : <div className="lab-training-empty" role="status"><span>{sessionIds.length ? '✓' : '◇'}</span>
      <h3>{sessionIds.length ? '这一轮，练完了。' : wrongOnly ? '这里暂时没有错题。' : '当前没有题目。'}</h3>
      <p>{sessionIds.length ? `本轮检查 ${sessionAnswered} 次，答对 ${sessionCorrect} 次。多做一轮，观察计算是否更顺手。` : '选择其他分类，或开始综合练习。答错的题会留在错题练习里，直到最近一次答对。'}</p>
      <button type="button" onClick={() => startSession('all', false)}>开始一轮综合练习</button></div>}
  </section>;
}
