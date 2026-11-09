import type { PokerTerm } from './terms';

/** Match familiar spellings such as all in, All-in, ALLIN and curly-apostrophe Hold’em. */
export function normalizeTermSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{Dash_Punctuation}'‘’ʼ`·•]/gu, '');
}

export function matchesTermSearch(term: PokerTerm, query: string): boolean {
  const needle = normalizeTermSearch(query);
  return [term.chinese, term.english, term.definition, term.example]
    .some(field => normalizeTermSearch(field).includes(needle));
}
