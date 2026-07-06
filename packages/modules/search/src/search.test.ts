import { describe, expect, it } from 'vitest';
import type { SearchDoc } from './types.js';
import { searchDocs } from './search.js';

const docs: SearchDoc[] = [
  { id: '1', kind: 'event', title: 'Dentist appointment', date: '2026-07-06' },
  { id: '2', kind: 'task', title: 'Book flights', keywords: ['travel', 'berlin'] },
  { id: '3', kind: 'meal', title: 'Chicken curry', keywords: ['dinner', 'spicy'] },
  { id: '4', kind: 'event', title: 'Team dentist visit', date: '2026-08-01' },
];

describe('searchDocs (P8 findability)', () => {
  it('returns nothing for an empty query (never the whole corpus)', () => {
    expect(searchDocs(docs, '')).toEqual([]);
    expect(searchDocs(docs, '   ')).toEqual([]);
  });

  it('ranks a title prefix above a mid-title match', () => {
    const hits = searchDocs(docs, 'dentist');
    expect(hits.map((d) => d.id)).toEqual(['1', '4']);
  });

  it('matches keywords when the title does not', () => {
    expect(searchDocs(docs, 'berlin').map((d) => d.id)).toEqual(['2']);
    expect(searchDocs(docs, 'spicy').map((d) => d.id)).toEqual(['3']);
  });

  it('requires every term to match (AND)', () => {
    expect(searchDocs(docs, 'chicken curry').map((d) => d.id)).toEqual(['3']);
    expect(searchDocs(docs, 'chicken flights')).toEqual([]);
  });

  it('respects the result limit and never throws on an empty corpus', () => {
    expect(searchDocs(docs, 'e', 1)).toHaveLength(1);
    expect(searchDocs([], 'anything')).toEqual([]);
  });
});
