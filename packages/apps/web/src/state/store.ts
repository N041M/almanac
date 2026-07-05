import { create } from 'zustand';
import {
  addDays,
  addMonths,
  applyManifests,
  getSlice,
  type Day,
  type ISODate,
  type Locale,
  type SliceCodec,
  EN_US,
} from '@almanac/core';
import { mealsManifest } from '@almanac/meals';
import { DAY_MARK_NAMESPACE, dayMarkCodec, type DayMark } from './day-mark';
import { dayStore } from './persistence';
import { useUndo } from './undo';
import { today } from '../clock';
import i18n from '../i18n/config';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'timeline';

/** How many days the agenda looks ahead (incl. today). */
export const AGENDA_DAYS = 14;

// Every module's day-slice codecs, from their manifests — the calendar reads
// whole Day records and renders whatever contributions exist (L1: the shell
// wires modules; the calendar knows namespaces, never module internals).
const DAY_CODECS: ReadonlyArray<SliceCodec<unknown>> = [
  dayMarkCodec as SliceCodec<unknown>,
  ...applyManifests([mealsManifest]).codecs,
];

/** How far one prev/next step moves the anchor, per view. */
const STEP: Record<CalendarView, (anchor: ISODate, dir: 1 | -1) => ISODate> = {
  month: (anchor, dir) => addMonths(anchor, dir),
  week: (anchor, dir) => addDays(anchor, 7 * dir),
  day: (anchor, dir) => addDays(anchor, dir),
  agenda: (anchor, dir) => addDays(anchor, 14 * dir),
  timeline: (anchor, dir) => addDays(anchor, 7 * dir),
};

interface CalendarState {
  locale: Locale;
  view: CalendarView;
  /** The date the visible range is built around (its month / week / day). */
  anchor: ISODate;
  selected: ISODate | null;
  /** The visible range's Day records — every module's contributions. */
  days: Readonly<Record<ISODate, Day>>;
  /** Starred dates for the visible range (derived from `days`, kept flat). */
  starred: Readonly<Record<ISODate, boolean>>;

  setLocale: (locale: Locale) => void;
  setView: (view: CalendarView) => void;
  prev: () => void;
  next: () => void;
  goToday: () => void;
  select: (date: ISODate) => void;
  toggleStar: (date: ISODate) => Promise<void>;
  /** Load the slices for the visible range. Driven by the view's effect
   *  (it owns the range) — actions only change state, they don't load. */
  loadRange: (first: ISODate, last: ISODate) => Promise<void>;
  /** Re-read the last loaded range (module state changed under the grid). */
  invalidateDays: () => Promise<void>;
}

export const useCalendar = create<CalendarState>((set, get) => {
  // Guards against out-of-order async loads clobbering the current range.
  let loadToken = 0;
  let lastRange: [ISODate, ISODate] | null = null;

  return {
    locale: EN_US,
    view: 'month',
    anchor: today(),
    selected: null,
    days: {},
    starred: {},

    setLocale: (locale) => {
      void i18n.changeLanguage(locale.language);
      set({ locale });
    },
    setView: (view) => set({ view }),
    prev: () => set((s) => ({ anchor: STEP[s.view](s.anchor, -1) })),
    next: () => set((s) => ({ anchor: STEP[s.view](s.anchor, 1) })),
    goToday: () => {
      const t = today();
      set({ anchor: t, selected: t });
    },
    // Selecting also re-anchors the range, so clicking a lead/trail day or
    // arrowing past a month/week edge navigates naturally.
    select: (date) => set({ selected: date, anchor: date }),

    toggleStar: async (date) => {
      const before = get().starred[date] ?? false;
      // Optimistic: the UI answers even when persistence can't (quota, private
      // mode). A failed write degrades to session-only state, quietly (L5).
      set((s) => ({ starred: { ...s.starred, [date]: !before } }));
      try {
        await dayStore.writeSlice(date, dayMarkCodec, { starred: !before });
      } catch {
        // Persistence unavailable; in-memory state already reflects the action.
      }
      useUndo.getState().push({
        labelKey: before ? 'unstar' : 'star',
        apply: async () => {
          useCalendar.setState((s) => ({ starred: { ...s.starred, [date]: before } }));
          await dayStore.writeSlice(date, dayMarkCodec, { starred: before });
        },
      });
    },

    loadRange: async (first, last) => {
      const seq = ++loadToken;
      lastRange = [first, last];
      const loaded = await dayStore.getRange(first, last, DAY_CODECS);
      if (seq !== loadToken) return; // a newer load started; drop this stale result

      const days: Record<ISODate, Day> = {};
      const starred: Record<ISODate, boolean> = {};
      for (const day of loaded) {
        days[day.date] = day;
        if (getSlice<DayMark>(day, DAY_MARK_NAMESPACE)?.starred === true) starred[day.date] = true;
      }
      set({ days, starred });
    },

    invalidateDays: async () => {
      if (lastRange !== null) await get().loadRange(lastRange[0], lastRange[1]);
    },
  };
});
