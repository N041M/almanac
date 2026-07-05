import { addDays, foldText, isValidISODate, weekdayOf, type ISODate } from '@almanac/core';
import type { Priority } from '@almanac/core';

/**
 * Keyboard-first quick entry (§8): inline sigils (`#category`, `@context`,
 * `!1..3`) plus natural-language dates/times, English + Czech, matched
 * simultaneously (no language switch needed). Pure logic; the input widget is
 * per-client.
 *
 * The L5 contract: **entry is never blocked by the parser** — anything it
 * can't read stays in the title, and a fully unparseable text is simply a
 * title with no date.
 */
export interface QuickEntry {
  title: string;
  categories: string[];
  contexts: string[];
  priority?: Priority;
  date?: ISODate;
  /** Minutes into the day (floating wall-clock, D7). */
  minutes?: number;
}

// Diacritic folding comes from the core (shared with food-name matching, L1).
const fold = foldText;

const WEEKDAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAYS_CS = ['nedele', 'pondeli', 'utery', 'streda', 'ctvrtek', 'patek', 'sobota'];

const DAY_UNITS = /^(days?|dny|dni|dnu|den)$/;
const WEEK_UNITS = /^(weeks?|tydny|tydnu|tyden)$/;

/** The soonest date strictly after `today` falling on `weekday`. */
function nextWeekday(today: ISODate, weekday: number): ISODate {
  const delta = (weekday - weekdayOf(today) + 7) % 7 || 7;
  return addDays(today, delta);
}

/** "25.12." / "25.12.2026" — past dates without a year roll to next year. */
function numericDate(token: string, today: ISODate): ISODate | undefined {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/.exec(token) ?? /^(\d{1,2})\.(\d{1,2})$/.exec(token);
  if (m === null) return undefined;
  const day = m[1]?.padStart(2, '0') ?? '';
  const month = m[2]?.padStart(2, '0') ?? '';
  const year = m[3];
  if (year !== undefined) {
    const date = `${year}-${month}-${day}`;
    return isValidISODate(date) ? date : undefined;
  }
  const thisYear = `${today.slice(0, 4)}-${month}-${day}`;
  if (!isValidISODate(thisYear)) return undefined;
  return thisYear >= today ? thisYear : `${Number(today.slice(0, 4)) + 1}-${month}-${day}`;
}

function timeOf(token: string): number | undefined {
  const clock = /^(\d{1,2}):(\d{2})$/.exec(token);
  if (clock !== null) {
    const h = Number(clock[1]);
    const m = Number(clock[2]);
    return h < 24 && m < 60 ? h * 60 + m : undefined;
  }
  const ampm = /^(\d{1,2})(am|pm)$/.exec(fold(token));
  if (ampm !== null) {
    const h = Number(ampm[1]);
    if (h < 1 || h > 12) return undefined;
    return ((h % 12) + (ampm[2] === 'pm' ? 12 : 0)) * 60;
  }
  return undefined;
}

/** A single token's date meaning, if any. */
function dateOf(token: string, today: ISODate): ISODate | undefined {
  const folded = fold(token);
  if (folded === 'today' || folded === 'dnes') return today;
  if (folded === 'tomorrow' || folded === 'zitra') return addDays(today, 1);
  if (folded === 'pozitri') return addDays(today, 2);
  const en = WEEKDAYS_EN.indexOf(folded);
  if (en !== -1) return nextWeekday(today, en);
  const cs = WEEKDAYS_CS.indexOf(folded);
  if (cs !== -1) return nextWeekday(today, cs);
  if (isValidISODate(token)) return token;
  return numericDate(token, today);
}

export function parseQuickEntry(text: string, today: ISODate): QuickEntry {
  const tokens = text.trim().split(/\s+/).filter((t) => t !== '');
  const categories: string[] = [];
  const contexts: string[] = [];
  let priority: Priority | undefined;
  let date: ISODate | undefined;
  let minutes: number | undefined;

  const rest: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';

    const sigil = /^([#@!])(.+)$/.exec(token);
    if (sigil !== null) {
      const body = sigil[2] ?? '';
      if (sigil[1] === '#') {
        categories.push(fold(body));
        continue;
      }
      if (sigil[1] === '@') {
        contexts.push(fold(body));
        continue;
      }
      if (/^[123]$/.test(body)) {
        priority = Number(body) as Priority;
        continue;
      }
    }

    // "in 3 days" / "za 2 týdny" — a three-token relative date.
    const folded = fold(token);
    if (date === undefined && (folded === 'in' || folded === 'za')) {
      const n = Number(tokens[i + 1]);
      const unit = fold(tokens[i + 2] ?? '');
      if (Number.isInteger(n) && n > 0) {
        if (DAY_UNITS.test(unit)) {
          date = addDays(today, n);
          i += 2;
          continue;
        }
        if (WEEK_UNITS.test(unit)) {
          date = addDays(today, n * 7);
          i += 2;
          continue;
        }
      }
    }

    if (date === undefined) {
      const parsed = dateOf(token, today);
      if (parsed !== undefined) {
        date = parsed;
        continue;
      }
    }

    if (minutes === undefined) {
      const parsed = timeOf(token);
      if (parsed !== undefined) {
        minutes = parsed;
        // A dangling "at"/"v"/"ve" before the time reads as part of it.
        const prev = fold(rest[rest.length - 1] ?? '');
        if (prev === 'at' || prev === 'v' || prev === 've') rest.pop();
        continue;
      }
    }

    rest.push(token);
  }

  return {
    title: rest.join(' '),
    categories,
    contexts,
    ...(priority !== undefined && { priority }),
    ...(date !== undefined && { date }),
    ...(minutes !== undefined && { minutes }),
  };
}
