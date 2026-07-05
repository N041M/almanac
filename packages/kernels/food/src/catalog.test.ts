import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '@almanac/core';
import type { StoragePort } from '@almanac/core';
import { createFoodCatalog } from './catalog.js';
import { INGREDIENT_SCHEMA_VERSION } from './codecs.js';
import type { Ingredient } from './ingredient.js';
import type { Recipe } from './recipe.js';

const paprika: Ingredient = {
  id: 'paprika',
  name: 'Paprika',
  tags: ['vegetables'],
  defaultUnit: 'piece',
  nutrition: { per100g: { kcal: 31 } },
};

const goulash: Recipe = {
  id: 'goulash',
  name: 'Goulash',
  tags: ['czech'],
  ingredients: [
    { ingredientId: 'paprika', quantity: { value: 2, unit: 'piece' } },
    { ingredientId: 'beef', quantity: { value: 0.5, unit: 'kg' } },
  ],
  servings: 4,
};

describe('createFoodCatalog', () => {
  it('round-trips ingredients and recipes', async () => {
    const catalog = createFoodCatalog(createMemoryStorage());
    await catalog.saveIngredient(paprika);
    await catalog.saveRecipe(goulash);
    expect(await catalog.getIngredient('paprika')).toEqual(paprika);
    expect(await catalog.getRecipe('goulash')).toEqual(goulash);
  });

  it('returns null for absent records', async () => {
    const catalog = createFoodCatalog(createMemoryStorage());
    expect(await catalog.getIngredient('nope')).toBeNull();
    expect(await catalog.getRecipe('nope')).toBeNull();
  });

  it('stamps writes modified-at when a clock is given (sync-ready, D4)', async () => {
    const storage = createMemoryStorage();
    const catalog = createFoodCatalog(storage, { now: () => 1234 });
    await catalog.saveIngredient(paprika);
    const raw = await storage.read('food:ingredient:paprika');
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ v: INGREDIENT_SCHEMA_VERSION, m: 1234 });
  });

  it('a corrupt or unknown-version record degrades to null and is skipped in lists', async () => {
    const storage = createMemoryStorage({
      'food:ingredient:bad': 'not json{',
      'food:ingredient:old': JSON.stringify({ v: 999, d: paprika }),
    });
    const catalog = createFoodCatalog(storage);
    await catalog.saveIngredient(paprika);
    expect(await catalog.getIngredient('bad')).toBeNull();
    expect(await catalog.getIngredient('old')).toBeNull();
    expect(await catalog.listIngredients()).toEqual([paprika]); // neighbours stand (L5)
  });

  it('a malformed ingredient line is dropped; the recipe survives (L5)', async () => {
    const storage = createMemoryStorage();
    const catalog = createFoodCatalog(storage);
    await catalog.saveRecipe(goulash);
    const key = 'food:recipe:goulash';
    const envelope = JSON.parse((await storage.read(key)) ?? '{}') as { d: Recipe };
    (envelope.d.ingredients as unknown[]).push({ broken: true });
    await storage.write(key, JSON.stringify(envelope));

    const read = await catalog.getRecipe('goulash');
    expect(read?.ingredients).toEqual(goulash.ingredients);
  });

  it('removes records', async () => {
    const catalog = createFoodCatalog(createMemoryStorage());
    await catalog.saveIngredient(paprika);
    await catalog.removeIngredient('paprika');
    expect(await catalog.getIngredient('paprika')).toBeNull();
    expect(await catalog.listIngredients()).toEqual([]);
  });

  it('lists via per-key reads when the backend has no readMany (L5)', async () => {
    const base = createMemoryStorage();
    const noBatch: StoragePort = {
      read: (key) => base.read(key),
      write: (key, value) => base.write(key, value),
      remove: (key) => base.remove(key),
      keys: (prefix) => base.keys(prefix),
    };
    const catalog = createFoodCatalog(noBatch);
    await catalog.saveIngredient(paprika);
    expect(await catalog.listIngredients()).toEqual([paprika]);
  });

  it('reads and lists never throw on storage failures', async () => {
    const broken: StoragePort = {
      read: () => Promise.reject(new Error('io')),
      write: () => Promise.reject(new Error('io')),
      remove: () => Promise.reject(new Error('io')),
      keys: () => Promise.reject(new Error('io')),
    };
    const catalog = createFoodCatalog(broken);
    expect(await catalog.getIngredient('paprika')).toBeNull();
    expect(await catalog.listIngredients()).toEqual([]);
    expect(await catalog.listRecipes()).toEqual([]);
  });
});
