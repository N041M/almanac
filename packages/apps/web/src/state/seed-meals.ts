import type { StoragePort } from '@almanac/core';
import type { FoodCatalog, Recipe } from '@almanac/food';
import { WEIGHT_PRESETS, type MealsStore, type PlanItem } from '@almanac/meals';

/**
 * First-run starter meals, so the planner is testable before the user has
 * entered anything. Seeded exactly once (a flag key remembers, so deleting
 * them all doesn't resurrect them) and only into an empty store.
 */
const SEEDED_FLAG = 'meals:seeded';

interface SeedMeal {
  name: string;
  tags: string[];
  weight: number;
  servings?: number;
  ingredients?: { name: string; value: number; unit: string }[];
}

const SEED_MEALS: SeedMeal[] = [
  {
    name: 'Spaghetti Bolognese',
    tags: ['italian', 'pasta'],
    weight: WEIGHT_PRESETS.often,
    servings: 4,
    ingredients: [
      { name: 'Minced beef', value: 400, unit: 'g' },
      { name: 'Spaghetti', value: 500, unit: 'g' },
      { name: 'Tomato passata', value: 500, unit: 'ml' },
      { name: 'Onion', value: 1, unit: 'piece' },
    ],
  },
  {
    name: 'Chicken Curry',
    tags: ['indian', 'spicy'],
    weight: WEIGHT_PRESETS.normal,
    servings: 4,
    ingredients: [
      { name: 'Chicken breast', value: 500, unit: 'g' },
      { name: 'Rice', value: 300, unit: 'g' },
      { name: 'Coconut milk', value: 400, unit: 'ml' },
    ],
  },
  {
    name: 'Goulash',
    tags: ['czech', 'hearty'],
    weight: WEIGHT_PRESETS.normal,
    servings: 4,
    ingredients: [
      { name: 'Beef chuck', value: 600, unit: 'g' },
      { name: 'Onion', value: 3, unit: 'piece' },
      { name: 'Paprika', value: 2, unit: 'tbsp' },
    ],
  },
  { name: 'Pizza Margherita', tags: ['italian'], weight: WEIGHT_PRESETS.favourite },
  { name: 'Fried Rice', tags: ['asian', 'quick'], weight: WEIGHT_PRESETS.normal },
  { name: 'Tacos', tags: ['mexican', 'quick'], weight: WEIGHT_PRESETS.often },
  { name: 'Grilled Salmon', tags: ['fish', 'healthy'], weight: WEIGHT_PRESETS.normal },
  { name: 'Caesar Salad', tags: ['salad', 'quick'], weight: WEIGHT_PRESETS.normal },
  { name: 'Tomato Soup', tags: ['soup', 'vegetarian'], weight: WEIGHT_PRESETS.rare },
  { name: 'Lentil Dahl', tags: ['indian', 'vegetarian'], weight: WEIGHT_PRESETS.rare },
];

/**
 * Seed once into an empty store. Any failure leaves the app in the ordinary
 * empty state — starter content is a convenience, never a requirement (L5).
 */
export async function seedStarterMeals(
  storage: StoragePort,
  catalog: FoodCatalog,
  mealsStore: MealsStore,
): Promise<boolean> {
  try {
    if ((await storage.read(SEEDED_FLAG)) !== null) return false;
    if ((await mealsStore.getItems()).length > 0) return false;

    const items: PlanItem[] = [];
    for (const seed of SEED_MEALS) {
      const recipe: Recipe = {
        id: crypto.randomUUID(),
        name: seed.name,
        tags: seed.tags,
        servings: seed.servings ?? 2,
        ingredients: [],
      };
      for (const line of seed.ingredients ?? []) {
        const ingredient = { id: crypto.randomUUID(), name: line.name, tags: [] };
        await catalog.saveIngredient(ingredient);
        recipe.ingredients.push({
          ingredientId: ingredient.id,
          quantity: { value: line.value, unit: line.unit },
        });
      }
      await catalog.saveRecipe(recipe);
      items.push({
        recipeId: recipe.id,
        weight: seed.weight,
        cooldownDays: null,
        enabled: true,
        lastServed: null,
      });
    }
    await mealsStore.saveItems(items);
    await storage.write(SEEDED_FLAG, '1');
    return true;
  } catch {
    return false; // seeding is additive; failing quietly is the contract (L5)
  }
}
