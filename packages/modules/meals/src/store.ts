import type { Clock, DayStore, ISODate, SliceCodec, StoragePort } from '@almanac/core';
import { addDays, getSlice } from '@almanac/core';
import type { PlanItem, Settings, WeekPlan } from './engine/types.js';
import { dayNameOf } from './engine/generate-week.js';
import { mealsDayCodec, MEALS_NAMESPACE, type MealsDaySlice } from './slice.js';

// The module's own (non-day) state: plan items + settings, one key each,
// versioned envelopes like every slice (§11). Reads never throw — corrupt or
// unknown-version payloads degrade to defaults in isolation (L5).

const ITEMS_KEY = 'meals:items';
const SETTINGS_KEY = 'meals:settings';
export const MEALS_ITEMS_VERSION = 1;
export const MEALS_SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: Omit<Settings, 'weekStart'> = {
  defaultCooldown: 2,
  variety: 0.5,
  noWeekRepeat: true,
  avoidSameTag: true,
};

interface Envelope {
  v: number;
  d: unknown;
  m?: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function decodeItem(value: unknown): PlanItem | null {
  if (!isRecord(value) || typeof value['recipeId'] !== 'string') return null;
  const weight = asFinite(value['weight']);
  const cooldown = asFinite(value['cooldownDays']);
  return {
    recipeId: value['recipeId'],
    weight: weight !== undefined && weight >= 0 ? weight : 1,
    cooldownDays: cooldown !== undefined && cooldown >= 0 ? cooldown : null,
    enabled: value['enabled'] !== false,
    lastServed: typeof value['lastServed'] === 'string' ? value['lastServed'] : null,
  };
}

function decodeSettings(value: unknown, fallbackWeekStart: ISODate): Settings {
  const base: Settings = { ...DEFAULT_SETTINGS, weekStart: fallbackWeekStart };
  if (!isRecord(value)) return base;
  const cooldown = asFinite(value['defaultCooldown']);
  const variety = asFinite(value['variety']);
  return {
    defaultCooldown: cooldown !== undefined && cooldown >= 0 ? cooldown : base.defaultCooldown,
    variety: variety !== undefined ? Math.min(1, Math.max(0, variety)) : base.variety,
    noWeekRepeat:
      typeof value['noWeekRepeat'] === 'boolean' ? value['noWeekRepeat'] : base.noWeekRepeat,
    avoidSameTag:
      typeof value['avoidSameTag'] === 'boolean' ? value['avoidSameTag'] : base.avoidSameTag,
    weekStart: typeof value['weekStart'] === 'string' ? value['weekStart'] : base.weekStart,
  };
}

/**
 * The meals module's persistence: plan items + settings under module keys,
 * the week plan as seven day slices (the day record is the shared surface the
 * calendar reads, §5). Framework-free; the UI layer composes it.
 */
export interface MealsStore {
  getItems(): Promise<PlanItem[]>;
  saveItems(items: ReadonlyArray<PlanItem>): Promise<void>;
  /** `fallbackWeekStart` seeds the default when nothing (usable) is stored. */
  getSettings(fallbackWeekStart: ISODate): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  /** The week's seven day slices as a WeekPlan (absent days = empty slots). */
  readWeek(weekStart: ISODate): Promise<WeekPlan>;
  /** Persist each entry to its day slice. */
  writeWeek(plan: WeekPlan): Promise<void>;
  /** One day's slice (absent/corrupt reads as the empty slice, L5). */
  readDay(date: ISODate): Promise<MealsDaySlice>;
  /** Persist one day — single-day changes (lock, re-roll, paste) write once. */
  writeDay(date: ISODate, slice: MealsDaySlice): Promise<void>;
}

export function createMealsStore(
  storage: StoragePort,
  dayStore: DayStore,
  clock?: Clock,
): MealsStore {
  async function readKey(key: string, version: number): Promise<unknown> {
    let raw: string | null;
    try {
      raw = await storage.read(key);
    } catch {
      return undefined;
    }
    if (raw === null) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isEnvelope(parsed) || parsed.v !== version) return undefined;
      return parsed.d;
    } catch {
      return undefined;
    }
  }

  async function writeKey(key: string, version: number, data: unknown): Promise<void> {
    const envelope: Envelope = {
      v: version,
      d: data,
      ...(clock !== undefined ? { m: clock.now() } : {}),
    };
    await storage.write(key, JSON.stringify(envelope));
  }

  return {
    getItems: async () => {
      const raw = await readKey(ITEMS_KEY, MEALS_ITEMS_VERSION);
      if (!Array.isArray(raw)) return [];
      // A malformed item costs only itself (L5).
      return raw.map(decodeItem).filter((item): item is PlanItem => item !== null);
    },
    saveItems: (items) => writeKey(ITEMS_KEY, MEALS_ITEMS_VERSION, items),

    getSettings: async (fallbackWeekStart) =>
      decodeSettings(await readKey(SETTINGS_KEY, MEALS_SETTINGS_VERSION), fallbackWeekStart),
    saveSettings: (settings) => writeKey(SETTINGS_KEY, MEALS_SETTINGS_VERSION, settings),

    readWeek: async (weekStart) => {
      // One batched range read (readMany underneath) instead of 7 round-trips.
      const days = await dayStore.getRange(weekStart, addDays(weekStart, 6), [
        mealsDayCodec as SliceCodec<unknown>,
      ]);
      return days.map((day) => ({
        dayName: dayNameOf(day.date),
        date: day.date,
        ...(getSlice<MealsDaySlice>(day, MEALS_NAMESPACE) ?? mealsDayCodec.default()),
      }));
    },
    writeWeek: async (plan) => {
      for (const entry of plan) {
        await dayStore.writeSlice(entry.date, mealsDayCodec, {
          recipeId: entry.recipeId,
          locked: entry.locked,
          breakdown: entry.breakdown,
        });
      }
    },
    readDay: (date) => dayStore.readSlice(date, mealsDayCodec),
    writeDay: (date, slice) => dayStore.writeSlice(date, mealsDayCodec, slice),
  };
}
