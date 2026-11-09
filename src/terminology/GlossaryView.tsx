import { useState } from 'react';
import { terms, termCategories } from './terms';
import type { TermCategory, TermId } from './terms';
import { matchesTermSearch } from './search';
import './terminology.css';

export function PositionDiagram() {
  const seats: { id: TermId; className: string; label: string }[] = [
    { id: 'utg', className: 'utg', label: '① 翻前先行动' }, { id: 'hj', className: 'hj', label: '②' },
    { id: 'co', className: 'co', label: '③' }, { id: 'btn', className: 'btn', label: '④ 庄家按钮' },
    { id: 'sb', className: 'sb', label: '⑤ 小盲' }, { id: 'bb', className: 'bb', label: '⑥ 大盲' },
  ];
  return <figure className="lab-position-figure">
    <div className="lab-position-diagram" role="img" aria-label="六人桌：翻前按 UTG、HJ、CO、BTN、SB、BB 顺序行动；翻后从仍在牌局的小盲侧开始，按钮通常最后行动。">
      <div className="lab-position-felt"><span>6-MAX</span><strong>六人桌位置</strong><small>顺时针行动与轮庄 ↻</small></div>
      {seats.map(({ id, className, label }) => <div className={`lab-position-seat ${className}`} key={id}>
        <strong>{id.toUpperCase()}</strong><span>{terms[id].english.split(' · ')[0]}</span><small>{label}</small>
      </div>)}
    </div>
    <figcaption>翻前：UTG → HJ → CO → BTN → SB → BB。翻后：SB → BB → UTG → HJ → CO → BTN，跳过已弃牌或全下者。单挑时 BTN = SB，翻前先行动，翻后后行动。</figcaption>
  </figure>;
}

export function GlossaryView() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TermCategory | '全部'>('全部');
  const entries = Object.entries(terms).filter(([, term]) => (category === '全部' || term.category === category)
    && matchesTermSearch(term, query));
  return <section className="lab-glossary">
    <div className="lab-glossary-heading"><div><span className="lab-section-eyebrow">THE POKER LANGUAGE</span><h2>先看懂，再行动。</h2>
      <p>常用术语、英文全称和具体例子。牌桌里的带问号词语也可以随时点开。</p></div><span className="lab-glossary-count">{Object.keys(terms).length} 个词条</span></div>
    <PositionDiagram />
    <div className="lab-glossary-controls"><label>搜索术语<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：全下 / Raise to / SPR" /></label>
      <div className="lab-term-filters" aria-label="术语分类">{(['全部', ...termCategories] as const).map(item => <button type="button" className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    </div>
    <p className="lab-glossary-results" role="status">找到 {entries.length} 个词条</p>
    <div className="lab-glossary-grid">{entries.map(([id, term]) => <article className="lab-glossary-card" id={`glossary-${id}`} key={id}>
      <span className="lab-glossary-category">{term.category}</span><h3>{term.chinese}</h3><p className="lab-glossary-english">{term.english}</p>
      <p>{term.definition}</p><div className="lab-glossary-example"><strong>例子</strong>{term.example}</div>
    </article>)}</div>
    {entries.length === 0 && <p className="lab-glossary-empty">没有匹配的术语。试试英文缩写，或切换到“全部”。</p>}
    <p className="lab-glossary-footnote">本练习使用标准无限注德州扑克规则；筹码均为练习分数。策略说明是学习提示，不代表唯一最优解。</p>
  </section>;
}
