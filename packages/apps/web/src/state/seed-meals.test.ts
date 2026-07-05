import { describe, expect, it } from 'vitest';
import { createDayStore, createMemoryStorage } from '@almanac/core';
import { createFoodCatalog } from '@almanac/food';
import { createMealsStore } from '@almanac/meals';
import { seedStarterMeals } from './seed-meals';

function setup() {
  const storage = createMemoryStorage();
  const catalog = createFoodCatalog(storage);
  const mealsStore = createMealsStore(storage, createDayStore(storage));
  return { storage, catalog, mealsStore };
}

describe('seedStarterMeals', () => {
  it('seeds recipes + plan items into an empty store, with tags and ingredients', async () => {
    const { storage, catalog, mealsStore } = setup();
    expect(await seedStarterMeals(storage, catalog, mealsStore)).toBe(true);

    const recipes = await catalog.listRecipes();
    const items = await mealsStore.getItems();
    expect(recipes.length).toBeGreaterThanOrEqual(10);
    expect(items).toHaveLength(recipes.length);
    expect(recipes.some((r) => r.ingredients.length > 0)).toBe(true);
    expect(recipes.every((r) => r.tags.length > 0)).toBe(true);
    // weights span the presets so the engine's fFreq is exercised
    expect(new Set(items.map((i) => i.weight)).size).toBeGreaterThanOrEqual(3);
  });

  it('is idempotent, and deleting everything does not resurrect the seeds', async () => {
    const { storage, catalog, mealsStore } = setup();
    await seedStarterMeals(storage, catalog, mealsStore);
    expect(await seedStarterMeals(storage, catalog, mealsStore)).toBe(false);

    await mealsStore.saveItems([]); // "user deleted all meals"
    expect(await seedStarterMeals(storage, catalog, mealsStore)).toBe(false);
  });

  it('never seeds over existing meals', async () => {
    const { storage, catalog, mealsStore } = setup();
    await mealsStore.saveItems([
      { recipeId: 'mine', weight: 1, cooldownDays: null, enabled: true, lastServed: null },
    ]);
    expect(await seedStarterMeals(storage, catalog, mealsStore)).toBe(false);
    expect(await mealsStore.getItems()).toHaveLength(1);
  });
});
