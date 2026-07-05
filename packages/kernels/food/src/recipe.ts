import type { Quantity } from '@almanac/core';
import type { NutritionFacts } from './nutrition.js';

export interface RecipeIngredient {
  ingredientId: string;
  quantity: Quantity;
}

/**
 * A meal's food attributes (§7). Planning attributes (weight, cooldown,
 * lastServed) live in the meals module, linked by this id — the kernel knows
 * nothing about planning (L1).
 */
export interface Recipe {
  id: string;
  name: string;
  /** Cuisine/type tags — the meal engine's same-tag penalty reads these (§6.4). */
  tags: string[];
  ingredients: RecipeIngredient[];
  servings: number;
  /** Manually entered facts; computed ones come from `deriveRecipeNutrition`. */
  nutrition?: NutritionFacts;
}
