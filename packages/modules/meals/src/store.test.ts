import { describe, expect, it } from 'vitest';
import { createDayStore, createMemoryStorage } from '@almanac/core';
import { createMealsStore, DEFAULT_SETTINGS } from './store.js';
import type { PlanItem, WeekPlan } from './engine/types.js';

const MONDAY = '2026-07-06';

function setup(seed?: Record<string, string>) {
  const storage = createMemoryStorage(seed);
  return { storage, store: createMealsStore(storage, createDayStore(storage)) };
}

const item: PlanItem = {
  recipeId: 'goulash',
  weight: 2,
  cooldownDays: 4,
  enabled: true,
  lastServed: '2026-07-01',
};

describe('createMealsStore', () => {
  it('round-trips items and settings', async () => {
    const { store } = setup();
    await store.saveItems([item]);
    expect(await store.getItems()).toEqual([item]);

    const settings = { ...DEFAULT_SETTINGS, variety: 0.8, weekStart: MONDAY };
    await store.saveSettings(settings);
    expect(await store.getSettings('2000-01-03')).toEqual(settings);
  });

  it('nothing stored ⇒ defaults with the caller’s week start (L5)', async () => {
    const { store } = setup();
    expect(await store.getItems()).toEqual([]);
    expect(await store.getSettings(MONDAY)).toEqual({ ...DEFAULT_SETTINGS, weekStart: MONDAY });
  });

  it('corrupt payloads degrade to defaults; malformed items cost only themselves', async () => {
    const { store } = setup({
      'meals:settings': 'not json{',
      'meals:items': JSON.stringify({ v: 1, d: [item, { broken: true }] }),
    });
    expect(await store.getSettings(MONDAY)).toEqual({ ...DEFAULT_SETTINGS, weekStart: MONDAY });
    expect(await store.getItems()).toEqual([item]);
  });

  it('week plans round-trip through day slices; absent days are empty slots', async () => {
    const { store } = setup();
    const empty = await store.readWeek(MONDAY);
    expect(empty).toHaveLength(7);
    expect(empty[0]).toMatchObject({ date: MONDAY, dayName: 'monday', recipeId: null });

    const plan: WeekPlan = empty.map((entry, i) =>
      i === 0 ? { ...entry, recipeId: 'goulash', locked: true } : entry,
    );
    await store.writeWeek(plan);
    const read = await store.readWeek(MONDAY);
    expect(read[0]).toMatchObject({ recipeId: 'goulash', locked: true });
    expect(read[1]?.recipeId).toBeNull();
  });
});
