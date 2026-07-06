import type { ISODate } from '@almanac/core';

/**
 * One searchable thing, produced by a source's text extractor. Modules don't
 * import each other (L1): the app collects docs from every module's state — a
 * module that registers no extractor simply isn't searchable (L5), the rest are.
 */
export interface SearchDoc {
  id: string;
  /** Source kind ('task' · 'event' · 'meal' · 'feed' …) — for grouping/icons. */
  kind: string;
  title: string;
  subtitle?: string;
  /** A date to jump to when the result is chosen, when the doc is dated. */
  date?: ISODate;
  /** Extra searchable terms (tags, categories, ingredients, location). */
  keywords?: string[];
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
}
