import { create } from 'zustand';
import {
  addMonths,
  buildMonthGrid,
  createDayStore,
  getSlice,
  type ISODate,
  type Locale,
  EN_US,
} from '@almanac/core';
import { createLocalStoragePort } from '../storage/local-storage-port';
import { dayMarkCodec, type DayMark } from './day-mark';
import { today } from '../clock';
import i18n from '../i18n/config';

// One day-store for the app, over the web storage adapter.
const dayStore = createDayStore(createLocalStoragePort());

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
  /** Load the visible month's slices. Driven by the view's effect on
   *  year/month/locale — actions only change state, they don't load. */
  loadMonth: () => Promise<void>;
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
      await dayStore.writeSlice(date, dayMarkCodec, { starred: next });
      set((s) => ({ starred: { ...s.starred, [date]: next } }));
    },

    loadMonth: async () => {
      const seq = ++loadToken;
      const { year, month, locale } = get();
      const grid = buildMonthGrid(year, month, locale.weekStartsOn);
      const first = grid[0]?.[0]?.date;
      const lastRow = grid[grid.length - 1];
      const last = lastRow?.[lastRow.length - 1]?.date;
      if (first === undefined || last === undefined) return;

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
