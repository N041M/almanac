// @almanac/food — shared substrate for meals/macros/shopping/pantry (§7).
// Depends on @almanac/core only (L1): types, derived nutrition, the product
// catalog over StoragePort, and the Open Food Facts NutritionPort adapter.

export type { MacroSet, NutritionFacts } from './nutrition.js';
export type { Ingredient } from './ingredient.js';
export type { Recipe, RecipeIngredient } from './recipe.js';
export type { DerivedNutrition } from './derive-nutrition.js';
export { deriveRecipeNutrition } from './derive-nutrition.js';
export {
  INGREDIENT_SCHEMA_VERSION,
  RECIPE_SCHEMA_VERSION,
  decodeIngredient,
  decodeRecipe,
} from './codecs.js';
export { normalizeFoodName, sameFoodName } from './food-name.js';
export type { FoodCatalog } from './catalog.js';
export { createFoodCatalog } from './catalog.js';
export type { FetchJson, OpenFoodFactsOptions } from './open-food-facts.js';
export {
  OFF_BASE_URL,
  OFF_SEARCH_PAGE_SIZE,
  createOpenFoodFactsPort,
} from './open-food-facts.js';

export const FOOD_KERNEL_VERSION = '0.0.0';
