import { create } from 'zustand';
import {
  addDays,
  addMonths,
  createDayStore,
  getSlice,
  type ISODate,
  type Locale,
  EN_US,
} from '@almanac/core';
import { createStoragePort } from '../storage/create-storage-port';
import { dayMarkCodec, type DayMark } from './day-mark';
import { systemClock, today } from '../clock';
import i18n from '../i18n/config';

// One day-store for the app, over the environment's storage adapter (SQLite in
// the Tauri shell, localStorage in the web port). The clock stamps writes with
// modified-at so slice data is sync-ready from day one (D4).
const dayStore = createDayStore(createStoragePort(), systemClock);

export type CalendarView = 'month' | 'week' | 'day';

/** How far one prev/next step moves the anchor, per view. */
const STEP: Record<CalendarView, (anchor: ISODate, dir: 1 | -1) => ISODate> = {
  month: (anchor, dir) => addMonths(anchor, dir),
  week: (anchor, dir) => addDays(anchor, 7 * dir),
  day: (anchor, dir) => addDays(anchor, dir),
};

interface CalendarState {
  locale: Locale;
  view: CalendarView;
  /** The date the visible range is built around (its month / week / day). */
  anchor: ISODate;
  selected: ISODate | null;
  /** Starred dates for the visible range (demo slice). */
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
}

export const useCalendar = create<CalendarState>((set, get) => {
  // Guards against out-of-order async loads clobbering the current range.
  let loadToken = 0;

  return {
    locale: EN_US,
    view: 'month',
    anchor: today(),
    selected: null,
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
      const next = !(get().starred[date] ?? false);
      // Optimistic: the UI answers even when persistence can't (quota, private
      // mode). A failed write degrades to session-only state, quietly (L5).
      set((s) => ({ starred: { ...s.starred, [date]: next } }));
      try {
        await dayStore.writeSlice(date, dayMarkCodec, { starred: next });
      } catch {
        // Persistence unavailable; in-memory state already reflects the action.
      }
    },

    loadRange: async (first, last) => {
      const seq = ++loadToken;
      const days = await dayStore.getRange(first, last, [dayMarkCodec]);
      if (seq !== loadToken) return; // a newer load started; drop this stale result

      const starred: Record<ISODate, boolean> = {};
      for (const day of days) {
        if (getSlice<DayMark>(day, 'demo')?.starred === true) starred[day.date] = true;
      }
      set({ starred });
    },
  };
});
