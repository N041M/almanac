import type { Clock, StoragePort } from '@almanac/core';
import type { Ingredient } from './ingredient.js';
import type { Recipe } from './recipe.js';
import {
  INGREDIENT_SCHEMA_VERSION,
  RECIPE_SCHEMA_VERSION,
  decodeIngredient,
  decodeRecipe,
} from './codecs.js';

const INGREDIENT_PREFIX = 'food:ingredient:';
const RECIPE_PREFIX = 'food:recipe:';

/** Same envelope shape as the day-store's slices (§11): version, data, modified-at. */
interface Envelope {
  v: number;
  d: unknown;
  m?: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

/**
 * The product catalog (§7): ingredients + recipes over `StoragePort`, one
 * record per key. Reads **never throw** — a missing, corrupt, or
 * unknown-version record degrades to `null` (or is skipped in lists) without
 * affecting its neighbours (L5). Writes propagate errors like every slice
 * write; `clock` stamps them modified-at so records are sync-ready (D4).
 */
export interface FoodCatalog {
  getIngredient(id: string): Promise<Ingredient | null>;
  listIngredients(): Promise<Ingredient[]>;
  saveIngredient(ingredient: Ingredient): Promise<void>;
  removeIngredient(id: string): Promise<void>;
  getRecipe(id: string): Promise<Recipe | null>;
  listRecipes(): Promise<Recipe[]>;
  saveRecipe(recipe: Recipe): Promise<void>;
  removeRecipe(id: string): Promise<void>;
}

export function createFoodCatalog(storage: StoragePort, clock?: Clock): FoodCatalog {
  function decodeRaw<T>(raw: string | null, version: number, decode: (d: unknown) => T | null): T | null {
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isEnvelope(parsed) || parsed.v !== version) return null;
      return decode(parsed.d);
    } catch {
      return null;
    }
  }

  async function get<T>(
    key: string,
    version: number,
    decode: (d: unknown) => T | null,
  ): Promise<T | null> {
    let raw: string | null;
    try {
      raw = await storage.read(key);
    } catch {
      return null; // storage read failure → absent (L5)
    }
    return decodeRaw(raw, version, decode);
  }

  async function list<T>(
    prefix: string,
    version: number,
    decode: (d: unknown) => T | null,
  ): Promise<T[]> {
    let keys: string[];
    try {
      keys = await storage.keys(prefix);
    } catch {
      return []; // enumeration failure → empty catalog view (L5)
    }
    let raws: (string | null)[];
    try {
      raws =
        storage.readMany !== undefined
          ? await storage.readMany(keys)
          : await Promise.all(keys.map((key) => storage.read(key)));
    } catch {
      return [];
    }
    // Corrupt records are skipped quietly; the rest of the catalog stands.
    return raws
      .map((raw) => decodeRaw(raw, version, decode))
      .filter((value): value is T => value !== null);
  }

  async function save(key: string, version: number, data: unknown): Promise<void> {
    const envelope: Envelope = {
      v: version,
      d: data,
      ...(clock !== undefined ? { m: clock.now() } : {}),
    };
    await storage.write(key, JSON.stringify(envelope));
  }

  return {
    getIngredient: (id) =>
      get(INGREDIENT_PREFIX + id, INGREDIENT_SCHEMA_VERSION, decodeIngredient),
    listIngredients: () =>
      list(INGREDIENT_PREFIX, INGREDIENT_SCHEMA_VERSION, decodeIngredient),
    saveIngredient: (ingredient) =>
      save(INGREDIENT_PREFIX + ingredient.id, INGREDIENT_SCHEMA_VERSION, ingredient),
    removeIngredient: (id) => storage.remove(INGREDIENT_PREFIX + id),
    getRecipe: (id) => get(RECIPE_PREFIX + id, RECIPE_SCHEMA_VERSION, decodeRecipe),
    listRecipes: () => list(RECIPE_PREFIX, RECIPE_SCHEMA_VERSION, decodeRecipe),
    saveRecipe: (recipe) =>
      save(RECIPE_PREFIX + recipe.id, RECIPE_SCHEMA_VERSION, recipe),
    removeRecipe: (id) => storage.remove(RECIPE_PREFIX + id),
  };
}
