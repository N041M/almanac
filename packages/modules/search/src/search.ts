import type { SearchDoc, SearchHit } from './types.js';

/** Default cap on returned results (the palette shows a short list). */
export const DEFAULT_SEARCH_LIMIT = 20;

/**
 * On-demand ranked search over a flat doc list (§8 findability). Every query
 * term must match somewhere (AND); a title match outranks a keyword match, and
 * a title *prefix* outranks a mid-word hit. Pure and deterministic (L3/L4):
 * an empty query or empty corpus yields `[]`, never a throw — search never
 * blocks the app (L5).
 */
export function searchDocs(
  docs: ReadonlyArray<SearchDoc>,
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): SearchDoc[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter((t) => t !== '');
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const title = doc.title.toLowerCase();
    const extra = [doc.subtitle?.toLowerCase() ?? '', ...(doc.keywords ?? []).map((k) => k.toLowerCase())];
    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      if (title.includes(term)) {
        score += title.startsWith(term) ? 3 : 2;
      } else if (extra.some((h) => h.includes(term))) {
        score += 1;
      } else {
        matchedAll = false;
        break;
      }
    }
    if (matchedAll) hits.push({ doc, score });
  }

  hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  return hits.slice(0, Math.max(0, limit)).map((h) => h.doc);
}
