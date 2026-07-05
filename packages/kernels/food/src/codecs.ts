import type { Quantity } from '@almanac/core';
import type { Ingredient } from './ingredient.js';
import type { Recipe, RecipeIngredient } from './recipe.js';
import type { MacroSet, NutritionFacts } from './nutrition.js';

// Persisted-shape validation for the catalog (design §11): decoders return
// `null` for anything unusable, so one bad record degrades to "absent" without
// touching the rest of the store (L5). Bump on shape changes.
export const INGREDIENT_SCHEMA_VERSION = 1;
export const RECIPE_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** String entries only; a malformed tags field degrades to no tags. */
function decodeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === 'string');
}

function decodeMacroSet(value: unknown): MacroSet | undefined {
  if (!isRecord(value)) return undefined;
  const set: MacroSet = {};
  const kcal = asFinite(value['kcal']);
  const proteinG = asFinite(value['proteinG']);
  const carbsG = asFinite(value['carbsG']);
  const fatG = asFinite(value['fatG']);
  if (kcal !== undefined) set.kcal = kcal;
  if (proteinG !== undefined) set.proteinG = proteinG;
  if (carbsG !== undefined) set.carbsG = carbsG;
  if (fatG !== undefined) set.fatG = fatG;
  return Object.keys(set).length > 0 ? set : undefined;
}

function decodeNutrition(value: unknown): NutritionFacts | undefined {
  if (!isRecord(value)) return undefined;
  const per100g = decodeMacroSet(value['per100g']);
  const perServing = decodeMacroSet(value['perServing']);
  if (per100g === undefined && perServing === undefined) return undefined;
  return { ...(per100g && { per100g }), ...(perServing && { perServing }) };
}

export function decodeIngredient(raw: unknown): Ingredient | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw['id']);
  const name = asString(raw['name']);
  if (id === undefined || name === undefined) return null;
  const defaultUnit = asString(raw['defaultUnit']);
  const barcode = asString(raw['barcode']);
  const nutrition = decodeNutrition(raw['nutrition']);
  return {
    id,
    name,
    tags: decodeTags(raw['tags']),
    ...(defaultUnit !== undefined && { defaultUnit }),
    ...(barcode !== undefined && { barcode }),
    ...(nutrition !== undefined && { nutrition }),
  };
}

/** A malformed ingredient line is skipped; the recipe survives (L5). */
function decodeRecipeIngredient(value: unknown): RecipeIngredient | null {
  if (!isRecord(value)) return null;
  const ingredientId = asString(value['ingredientId']);
  const quantity = value['quantity'];
  if (ingredientId === undefined || !isRecord(quantity)) return null;
  const amount = asFinite(quantity['value']);
  const unit = asString(quantity['unit']);
  if (amount === undefined || unit === undefined) return null;
  const parsed: Quantity = { value: amount, unit };
  return { ingredientId, quantity: parsed };
}

export function decodeRecipe(raw: unknown): Recipe | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw['id']);
  const name = asString(raw['name']);
  if (id === undefined || name === undefined) return null;
  const lines = Array.isArray(raw['ingredients']) ? raw['ingredients'] : [];
  const ingredients = lines
    .map(decodeRecipeIngredient)
    .filter((line): line is RecipeIngredient => line !== null);
  const servings = asFinite(raw['servings']);
  const nutrition = decodeNutrition(raw['nutrition']);
  return {
    id,
    name,
    tags: decodeTags(raw['tags']),
    ingredients,
    servings: servings !== undefined && servings > 0 ? servings : 1,
    ...(nutrition !== undefined && { nutrition }),
  };
}
