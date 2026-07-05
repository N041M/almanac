import { describe, expect, it } from 'vitest';
import { deriveRecipeNutrition } from './derive-nutrition.js';
import type { Ingredient } from './ingredient.js';
import type { Recipe } from './recipe.js';

const flour: Ingredient = {
  id: 'flour',
  name: 'Flour',
  tags: ['baking'],
  nutrition: { per100g: { kcal: 360, proteinG: 10, carbsG: 76, fatG: 1 } },
};
const butter: Ingredient = {
  id: 'butter',
  name: 'Butter',
  tags: ['dairy'],
  nutrition: { per100g: { kcal: 740, fatG: 82 } }, // sparse: no protein/carbs
};
const onion: Ingredient = { id: 'onion', name: 'Onion', tags: [] }; // no facts

const byId = new Map<string, Ingredient>([
  ['flour', flour],
  ['butter', butter],
  ['onion', onion],
]);

function recipe(overrides: Partial<Recipe>): Recipe {
  return { id: 'r', name: 'R', tags: [], ingredients: [], servings: 1, ...overrides };
}

describe('deriveRecipeNutrition', () => {
  it('sums per-100g facts over mass quantities, converting units', () => {
    const derived = deriveRecipeNutrition(
      recipe({
        servings: 2,
        ingredients: [
          { ingredientId: 'flour', quantity: { value: 200, unit: 'g' } },
          { ingredientId: 'flour', quantity: { value: 0.1, unit: 'kg' } }, // +100 g
        ],
      }),
      byId,
    );
    expect(derived.total.kcal).toBeCloseTo(360 * 3);
    expect(derived.total.proteinG).toBeCloseTo(30);
    expect(derived.perServing.kcal).toBeCloseTo((360 * 3) / 2);
    expect(derived.unaccounted).toEqual([]);
    expect(derived.servingsAssumed).toBe(false);
  });

  it('keeps sparse facts sparse — absent macros never read as 0', () => {
    const derived = deriveRecipeNutrition(
      recipe({ ingredients: [{ ingredientId: 'butter', quantity: { value: 50, unit: 'g' } }] }),
      byId,
    );
    expect(derived.total.kcal).toBeCloseTo(370);
    expect(derived.total.fatG).toBeCloseTo(41);
    expect(derived.total.proteinG).toBeUndefined();
    expect(derived.total.carbsG).toBeUndefined();
  });

  it('flags unknown ingredients, factless ingredients, and non-mass quantities — and keeps counting the rest', () => {
    const derived = deriveRecipeNutrition(
      recipe({
        ingredients: [
          { ingredientId: 'ghost', quantity: { value: 100, unit: 'g' } }, // not in catalog
          { ingredientId: 'onion', quantity: { value: 2, unit: 'piece' } }, // no facts
          { ingredientId: 'flour', quantity: { value: 100, unit: 'ml' } }, // volume: no density
          { ingredientId: 'flour', quantity: { value: 100, unit: 'g' } }, // counts
        ],
      }),
      byId,
    );
    expect(derived.unaccounted).toEqual(['ghost', 'onion', 'flour']);
    expect(derived.total.kcal).toBeCloseTo(360);
  });

  it('degrades invalid servings to 1 and flags it', () => {
    const derived = deriveRecipeNutrition(
      recipe({
        servings: 0,
        ingredients: [{ ingredientId: 'flour', quantity: { value: 100, unit: 'g' } }],
      }),
      byId,
    );
    expect(derived.servingsUsed).toBe(1);
    expect(derived.servingsAssumed).toBe(true);
    expect(derived.perServing.kcal).toBeCloseTo(360);
  });

  it('an empty recipe derives empty sets, quietly', () => {
    const derived = deriveRecipeNutrition(recipe({}), byId);
    expect(derived.total).toEqual({});
    expect(derived.perServing).toEqual({});
    expect(derived.unaccounted).toEqual([]);
  });
});
