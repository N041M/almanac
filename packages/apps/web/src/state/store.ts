import { create } from 'zustand';
import {
  addMonths,
  createDayStore,
  getSlice,
  type ISODate,
  type Locale,
  EN_US,
} from '@almanac/core';
import { createLocalStoragePort } from '../storage/local-storage-port';
import { dayMarkCodec, type DayMark } from './day-mark';
import { systemClock, today } from '../clock';
import i18n from '../i18n/config';

// One day-store for the app, over the web storage adapter. The clock stamps
// writes with modified-at so slice data is sync-ready from day one (D4).
const dayStore = createDayStore(createLocalStoragePort(), systemClock);

function anchorISO(year: number, month: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

interface CalendarState {
  locale: Locale;
  /** Anchor month (1–12) of the visible grid. */
  year: number;
  month: number;
  selected: ISODate | null;
  /** Starred dates for the visible grid (demo slice). */
  starred: Readonly<Record<ISODate, boolean>>;

  setLocale: (locale: Locale) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  goToday: () => void;
  select: (date: ISODate) => void;
  toggleStar: (date: ISODate) => Promise<void>;
  /** Load the slices for the visible grid range. Driven by the view's effect
   *  (it owns the grid) — actions only change state, they don't load. */
  loadRange: (first: ISODate, last: ISODate) => Promise<void>;
}

export const useCalendar = create<CalendarState>((set, get) => {
  const start = today();
  // Guards against out-of-order async loads clobbering the current month.
  let loadToken = 0;

  function setMonth(anchor: ISODate): void {
    set({ year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) });
  }

  return {
    locale: EN_US,
    year: Number(start.slice(0, 4)),
    month: Number(start.slice(5, 7)),
    selected: null,
    starred: {},

    setLocale: (locale) => {
      void i18n.changeLanguage(locale.language);
      set({ locale });
    },
    prevMonth: () => setMonth(addMonths(anchorISO(get().year, get().month), -1)),
    nextMonth: () => setMonth(addMonths(anchorISO(get().year, get().month), 1)),
    goToday: () => {
      const t = today();
      setMonth(t);
      set({ selected: t });
    },
    select: (date) => set({ selected: date }),

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
