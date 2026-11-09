import { describe, expect, it } from 'vitest';
import { terms } from './terms';
import { matchesTermSearch, normalizeTermSearch } from './search';

describe('centralized Chinese poker glossary', () => {
  it('provides at least 35 complete entries with concrete examples', () => {
    expect(Object.keys(terms).length).toBe(50);
    for (const [id, term] of Object.entries(terms)) {
      expect(term.chinese.length, id).toBeGreaterThan(0);
      expect(term.english.length, id).toBeGreaterThan(0);
      expect(term.definition.length, id).toBeGreaterThan(10);
      expect(term.example.length, id).toBeGreaterThan(10);
    }
  });
  it('matches space, dash, case and apostrophe variants in glossary search', () => {
    for (const query of ['all in', 'all-in', 'ALLIN', 'All–in', 'all\u00a0in']) {
      expect(matchesTermSearch(terms.allIn, query), query).toBe(true);
    }
    for (const query of ['check raise', 'check-raise', 'checkraise']) expect(matchesTermSearch(terms.checkRaise, query), query).toBe(true);
    for (const query of ['c bet', 'c-bet', 'cbet']) expect(matchesTermSearch(terms.cbet, query), query).toBe(true);
    for (const query of ['3 bet', '3-bet', '3bet']) expect(matchesTermSearch(terms.threeBet, query), query).toBe(true);
    expect(normalizeTermSearch('Hold’em')).toBe(normalizeTermSearch("Hold'em"));
    expect(matchesTermSearch(terms.noLimit, "hold'em")).toBe(true);
    expect(matchesTermSearch(terms.equity, '权益')).toBe(true);
    expect(matchesTermSearch(terms.allIn, 'nonexistent')).toBe(false);
  });
  it('includes six actions and canonical All-in / Raise to wording', () => {
    expect(terms.allIn.english).toBe('All-in');
    expect(terms.raise.english).toBe('Raise to');
    for (const id of ['fold', 'check', 'call', 'bet', 'raise', 'allIn'] as const) expect(terms[id].category).toBe('行动');
  });
  it('spells out all six-max positions and preserves heads-up exception', () => {
    expect(terms.utg.english).toContain('Under the Gun');
    expect(terms.hj.english).toContain('Hijack');
    expect(terms.co.english).toContain('Cutoff');
    expect(terms.btn.english).toContain('Button');
    expect(terms.sb.english).toContain('Small Blind');
    expect(terms.bb.english).toContain('Big Blind');
    expect(terms.btn.example).toContain('单挑');
  });
});
