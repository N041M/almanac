import { describe, expect, it } from 'vitest';
import { parseQuickEntry } from './quick-entry.js';

// 2026-07-05 is a Sunday.
const TODAY = '2026-07-05';

describe('parseQuickEntry — sigils (§8)', () => {
  it('extracts #categories, @contexts, and !priority; the title keeps the rest', () => {
    const entry = parseQuickEntry('buy milk #errands @store !2', TODAY);
    expect(entry).toEqual({
      title: 'buy milk',
      categories: ['errands'],
      contexts: ['store'],
      priority: 2,
    });
  });

  it('!N takes any positive integer — three levels were not enough (D9)', () => {
    expect(parseQuickEntry('ship release !5', TODAY).priority).toBe(5);
    expect(parseQuickEntry('ship release !12', TODAY).priority).toBe(12);
    // Zero is not a priority; the token stays in the title (never blocks entry, L5).
    const zero = parseQuickEntry('ship release !0', TODAY);
    expect(zero.priority).toBeUndefined();
    expect(zero.title).toContain('!0');
  });

  it('a non-priority bang token stays in the title', () => {
    expect(parseQuickEntry('deploy !now', TODAY).title).toBe('deploy !now');
  });
});

describe('parseQuickEntry — English dates/times', () => {
  it('"lunch with Anna tomorrow 13:00" (the design-doc example)', () => {
    expect(parseQuickEntry('lunch with Anna tomorrow 13:00', TODAY)).toEqual({
      title: 'lunch with Anna',
      categories: [],
      contexts: [],
      date: '2026-07-06',
      minutes: 13 * 60,
    });
  });

  it('weekday names mean the next such day; "at" folds into the time', () => {
    const entry = parseQuickEntry('dentist friday at 9:30', TODAY);
    expect(entry.date).toBe('2026-07-10');
    expect(entry.minutes).toBe(9 * 60 + 30);
    expect(entry.title).toBe('dentist');
  });

  it('relative ("in 3 days"), am/pm, and numeric dates', () => {
    expect(parseQuickEntry('review in 3 days', TODAY).date).toBe('2026-07-08');
    expect(parseQuickEntry('call mom 7pm', TODAY).minutes).toBe(19 * 60);
    expect(parseQuickEntry('tax return 25.12.', TODAY).date).toBe('2026-12-25');
    // a past D.M. without a year rolls to next year
    expect(parseQuickEntry('anniversary 1.3.', TODAY).date).toBe('2027-03-01');
  });
});

describe('parseQuickEntry — Czech, diacritic-insensitive', () => {
  it('"oběd s Annou zítra v 13:00"', () => {
    const entry = parseQuickEntry('oběd s Annou zítra v 13:00', TODAY);
    expect(entry.title).toBe('oběd s Annou');
    expect(entry.date).toBe('2026-07-06');
    expect(entry.minutes).toBe(13 * 60);
  });

  it('weekdays and relatives, with or without háčky', () => {
    expect(parseQuickEntry('zubař pátek', TODAY).date).toBe('2026-07-10');
    expect(parseQuickEntry('zubar patek', TODAY).date).toBe('2026-07-10');
    expect(parseQuickEntry('úklid za 2 týdny', TODAY).date).toBe('2026-07-19');
    expect(parseQuickEntry('pozítří schůzka', TODAY).date).toBe('2026-07-07');
  });
});

describe('parseQuickEntry — never blocks (L5)', () => {
  it('unparseable text is simply a title with no date', () => {
    expect(parseQuickEntry('just some words nobody scheduled', TODAY)).toEqual({
      title: 'just some words nobody scheduled',
      categories: [],
      contexts: [],
    });
  });

  it('only the first date wins; later date-like tokens stay in the title', () => {
    const entry = parseQuickEntry('move tomorrow monday', TODAY);
    expect(entry.date).toBe('2026-07-06');
    expect(entry.title).toBe('move monday');
  });
});
