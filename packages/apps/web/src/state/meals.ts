import { create } from 'zustand';
import {
  createSeededRng,
  startOfWeek,
  type ISODate,
  type NutritionResult,
} from '@almanac/core';
import {
  createFoodCatalog,
  createOpenFoodFactsPort,
  sameFoodName,
  type Ingredient,
  type Recipe,
} from '@almanac/food';
import {
  WEIGHT_PRESETS,
  commitWeek,
  createMealsStore,
  generateWeek,
  rerollDay,
  type MealsDaySlice,
  type PlanItem,
  type Settings,
  type WeekPlan,
} from '@almanac/meals';
import { dayStore, storagePort } from './persistence';
import { systemClock, today } from '../clock';

// Composition root for the meals module (L4 edges live here): the real clock
// seeds the Rng, and the engine itself stays pure and deterministic.
const catalog = createFoodCatalog(storagePort, systemClock);
const mealsStore = createMealsStore(storagePort, dayStore, systemClock);
const rng = createSeededRng(systemClock.now() >>> 0);

// Nutrition lookup (§7) — enrichment, never a gate: every failure path in the
// adapter resolves to "no data" and the ingredient simply stays fact-less.
// (Browsers drop the User-Agent header; it applies in the Tauri shell.)
const nutrition = createOpenFoodFactsPort({
  fetchJson: async (url, headers) => {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  },
  userAgent: 'Almanac/0.0 (personal calendar; desktop app)',
  cache: storagePort,
});

export type WeightPreset = keyof typeof WEIGHT_PRESETS;

/** The preset whose weight matches, for showing stored weights as presets. */
export function presetOf(weight: number): WeightPreset {
  const hit = (Object.keys(WEIGHT_PRESETS) as WeightPreset[]).find(
    (key) => WEIGHT_PRESETS[key] === weight,
  );
  return hit ?? 'normal';
}

interface MealsState {
  loaded: boolean;
  recipes: Readonly<Record<string, Recipe>>;
  ingredients: Readonly<Record<string, Ingredient>>;
  items: PlanItem[];
  settings: Settings | null;
  plan: WeekPlan;
  /** Index of the plan entry whose breakdown panel is open. */
  breakdownIndex: number | null;
  /** Per ingredient: the OFF products its nutrition guess can come from (session-only). */
  nutritionChoices: Readonly<Record<string, NutritionResult[]>>;
  /** Per ingredient: which choice is applied (null = "no match" chosen). */
  nutritionPick: Readonly<Record<string, number | null>>;
  /** Read-through cache of meals on dates outside the loaded plan week. */
  dayMeals: Readonly<Record<ISODate, string | null>>;
  /** The copied meal, ready to paste onto any day (tasks join at Phase 6). */
  mealClipboard: MealsDaySlice | null;

  load: () => Promise<void>;
  addMeal: (name: string, tags: string, preset: WeightPreset) => Promise<void>;
  removeMeal: (recipeId: string) => Promise<void>;
  updateItem: (recipeId: string, patch: Partial<PlanItem>) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  /** Add one ingredient line; reuses a catalog ingredient by name or creates it. */
  addIngredient: (recipeId: string, name: string, amount: number, unit: string) => Promise<void>;
  removeIngredient: (recipeId: string, line: number) => Promise<void>;
  setServings: (recipeId: string, servings: number) => Promise<void>;
  /** Look up OFF matches for an ingredient; auto-applies the first when factless. */
  guessNutrition: (ingredientId: string) => Promise<void>;
  /** Apply one of the looked-up matches (or none) as the ingredient's facts. */
  applyNutrition: (ingredientId: string, choice: number | null) => Promise<void>;
  generate: () => Promise<void>;
  reroll: (index: number) => Promise<void>;
  toggleLock: (index: number) => Promise<void>;
  commit: () => Promise<void>;
  showBreakdown: (index: number | null) => void;
  /** Ensure `dayMeals[date]` is loaded for a date outside the plan week. */
  loadDayMeal: (date: ISODate) => Promise<void>;
  /** Copy the meal planned on `date` (from the week plan or any other day). */
  copyMeal: (date: ISODate) => void;
  /** Paste the copied meal onto `date` — any day, any week. */
  pasteMeal: (date: ISODate) => Promise<void>;
}

/** This Monday (weekStart is locale-driven later; the engine only needs a date). */
function currentWeekStart(): ISODate {
  return startOfWeek(today(), 1);
}

/** Persist quietly: a failed write degrades to session-only state (L5). */
async function quietly(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch {
    // In-memory state already reflects the action.
  }
}

export const useMeals = create<MealsState>((set, get) => ({
  loaded: false,
  recipes: {},
  ingredients: {},
  items: [],
  settings: null,
  plan: [],
  breakdownIndex: null,
  nutritionChoices: {},
  nutritionPick: {},
  dayMeals: {},
  mealClipboard: null,

  load: async () => {
    if (get().loaded) return;
    const settings = await mealsStore.getSettings(currentWeekStart());
    const [recipeList, ingredientList, items, plan] = await Promise.all([
      catalog.listRecipes(),
      catalog.listIngredients(),
      mealsStore.getItems(),
      mealsStore.readWeek(settings.weekStart),
    ]);
    const recipes: Record<string, Recipe> = {};
    for (const recipe of recipeList) recipes[recipe.id] = recipe;
    const ingredients: Record<string, Ingredient> = {};
    for (const ingredient of ingredientList) ingredients[ingredient.id] = ingredient;
    set({ loaded: true, recipes, ingredients, items, settings, plan });
  },

  addMeal: async (name, tags, preset) => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    const recipe: Recipe = {
      id: crypto.randomUUID(),
      name: trimmed,
      tags: tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== ''),
      ingredients: [],
      servings: 2,
    };
    const item: PlanItem = {
      recipeId: recipe.id,
      weight: WEIGHT_PRESETS[preset],
      cooldownDays: null,
      enabled: true,
      lastServed: null,
    };
    const items = [...get().items, item];
    set((s) => ({ recipes: { ...s.recipes, [recipe.id]: recipe }, items }));
    await quietly(() => catalog.saveRecipe(recipe));
    await quietly(() => mealsStore.saveItems(items));
  },

  removeMeal: async (recipeId) => {
    const items = get().items.filter((item) => item.recipeId !== recipeId);
    set((s) => {
      const recipes = { ...s.recipes };
      delete recipes[recipeId];
      return { recipes, items };
    });
    await quietly(() => catalog.removeRecipe(recipeId));
    await quietly(() => mealsStore.saveItems(items));
  },

  updateItem: async (recipeId, patch) => {
    const items = get().items.map((item) =>
      item.recipeId === recipeId ? { ...item, ...patch } : item,
    );
    set({ items });
    await quietly(() => mealsStore.saveItems(items));
  },

  addIngredient: async (recipeId, name, amount, unit) => {
    const recipe = get().recipes[recipeId];
    const trimmed = name.trim();
    if (recipe === undefined || trimmed === '' || !Number.isFinite(amount) || amount <= 0) return;

    // Reuse the catalog entry this name identifies (one "Onion" app-wide —
    // shopping aggregates by ingredient id, §8.1). Identity = normalized
    // match ("Onions" ≡ "onion"), never fuzzy: typos surface as autocomplete
    // suggestions the user confirms, not silent merges.
    const existing = Object.values(get().ingredients).find((candidate) =>
      sameFoodName(candidate.name, trimmed),
    );
    const ingredient: Ingredient =
      existing ?? { id: crypto.randomUUID(), name: trimmed, tags: [], defaultUnit: unit };

    const nextRecipe: Recipe = {
      ...recipe,
      ingredients: [
        ...recipe.ingredients,
        { ingredientId: ingredient.id, quantity: { value: amount, unit } },
      ],
    };
    set((s) => ({
      recipes: { ...s.recipes, [recipeId]: nextRecipe },
      ingredients: existing !== undefined ? s.ingredients : { ...s.ingredients, [ingredient.id]: ingredient },
    }));
    if (existing === undefined) {
      await quietly(() => catalog.saveIngredient(ingredient));
      // Fire-and-forget: the guess never delays adding, and never gates (§7).
      void get().guessNutrition(ingredient.id);
    }
    await quietly(() => catalog.saveRecipe(nextRecipe));
  },

  guessNutrition: async (ingredientId) => {
    const ingredient = get().ingredients[ingredientId];
    if (ingredient === undefined) return;
    let matches: NutritionResult[];
    try {
      // English-only for now; other locales will translate the name to
      // English here before searching (see food-name.ts).
      matches = (await nutrition.search(ingredient.name)).filter(
        (result) => result.per100g !== undefined,
      );
    } catch {
      return; // offline/error: quietly no choices, ingredient stays factless (L5)
    }
    if (get().ingredients[ingredientId] === undefined) return; // removed meanwhile
    // When facts already exist (previous session), point the pick at the
    // matching choice so the selector reflects what's actually applied.
    const applied = get().ingredients[ingredientId]?.nutrition?.per100g;
    const appliedIndex =
      applied === undefined
        ? undefined
        : matches.findIndex((m) => JSON.stringify(m.per100g) === JSON.stringify(applied));
    set((s) => ({
      nutritionChoices: { ...s.nutritionChoices, [ingredientId]: matches },
      ...(appliedIndex !== undefined && appliedIndex >= 0
        ? { nutritionPick: { ...s.nutritionPick, [ingredientId]: appliedIndex } }
        : {}),
    }));
    // Auto-apply the top match only when the ingredient has no facts yet —
    // a user-confirmed pick is never overwritten by a background guess.
    if (matches.length > 0 && applied === undefined) {
      await get().applyNutrition(ingredientId, 0);
    }
  },

  applyNutrition: async (ingredientId, choice) => {
    const { ingredients, nutritionChoices } = get();
    const ingredient = ingredients[ingredientId];
    if (ingredient === undefined) return;
    const picked = choice === null ? undefined : nutritionChoices[ingredientId]?.[choice];
    if (choice !== null && picked?.per100g === undefined) return;

    const bare: Ingredient = { ...ingredient };
    delete bare.nutrition;
    const next: Ingredient =
      picked?.per100g === undefined ? bare : { ...bare, nutrition: { per100g: picked.per100g } };
    set((s) => ({
      ingredients: { ...s.ingredients, [ingredientId]: next },
      nutritionPick: { ...s.nutritionPick, [ingredientId]: choice },
    }));
    await quietly(() => catalog.saveIngredient(next));
  },

  removeIngredient: async (recipeId, line) => {
    const recipe = get().recipes[recipeId];
    if (recipe === undefined) return;
    const nextRecipe: Recipe = {
      ...recipe,
      ingredients: recipe.ingredients.filter((_, i) => i !== line),
    };
    set((s) => ({ recipes: { ...s.recipes, [recipeId]: nextRecipe } }));
    await quietly(() => catalog.saveRecipe(nextRecipe));
  },

  setServings: async (recipeId, servings) => {
    const recipe = get().recipes[recipeId];
    if (recipe === undefined || !Number.isFinite(servings) || servings <= 0) return;
    const nextRecipe: Recipe = { ...recipe, servings };
    set((s) => ({ recipes: { ...s.recipes, [recipeId]: nextRecipe } }));
    await quietly(() => catalog.saveRecipe(nextRecipe));
  },

  updateSettings: async (patch) => {
    const settings = get().settings;
    if (settings === null) return;
    const next = { ...settings, ...patch };
    set({ settings: next });
    await quietly(() => mealsStore.saveSettings(next));
  },

  generate: async () => {
    const { items, settings, plan, recipes } = get();
    if (settings === null) return;
    const next = generateWeek(items, new Map(Object.entries(recipes)), settings, plan, rng);
    // The plan is the truth for its dates now; drop any stale day cache.
    set({ plan: next, breakdownIndex: null, dayMeals: {} });
    await quietly(() => mealsStore.writeWeek(next));
  },

  reroll: async (index) => {
    const { items, settings, plan, recipes } = get();
    if (settings === null) return;
    const next = rerollDay(items, new Map(Object.entries(recipes)), settings, plan, index, rng);
    if (next === plan) return;
    set({ plan: next });
    const entry = next[index];
    if (entry !== undefined) {
      await quietly(() =>
        mealsStore.writeDay(entry.date, {
          recipeId: entry.recipeId,
          locked: entry.locked,
          breakdown: entry.breakdown,
        }),
      );
    }
  },

  toggleLock: async (index) => {
    const plan = get().plan.map((entry, i) =>
      i === index ? { ...entry, locked: !entry.locked } : entry,
    );
    set({ plan });
    const entry = plan[index];
    if (entry !== undefined) {
      await quietly(() =>
        mealsStore.writeDay(entry.date, {
          recipeId: entry.recipeId,
          locked: entry.locked,
          breakdown: entry.breakdown,
        }),
      );
    }
  },

  commit: async () => {
    const { items, settings, plan } = get();
    if (settings === null) return;
    const committed = commitWeek(items, plan);
    const weekStart = committed.nextWeekStart ?? settings.weekStart;
    const nextSettings = { ...settings, weekStart };
    // The old week's dates leave the plan; the cache must not answer for them.
    set({ items: committed.items, settings: nextSettings, breakdownIndex: null, dayMeals: {} });
    await quietly(() => mealsStore.saveItems(committed.items));
    await quietly(() => mealsStore.saveSettings(nextSettings));
    set({ plan: await mealsStore.readWeek(weekStart) });
  },

  showBreakdown: (index) => set({ breakdownIndex: index }),

  loadDayMeal: async (date) => {
    const { plan, dayMeals } = get();
    if (plan.some((entry) => entry.date === date)) return; // the plan covers it
    if (date in dayMeals) return;
    // readDay never throws — a missing/corrupt slice reads as empty (L5).
    const slice = await mealsStore.readDay(date);
    set((s) => ({ dayMeals: { ...s.dayMeals, [date]: slice.recipeId } }));
  },

  copyMeal: (date) => {
    const { plan, dayMeals } = get();
    // The plan is authoritative for its dates — even when the slot is empty;
    // the day cache only answers for dates outside the plan week.
    const entry = plan.find((e) => e.date === date);
    const recipeId = entry !== undefined ? entry.recipeId : (dayMeals[date] ?? null);
    // A copy is a fresh placement: no lock, and no breakdown — the pasted
    // meal wasn't drawn by the engine, so a "why this pick" would lie.
    set({ mealClipboard: recipeId === null ? null : { recipeId, locked: false, breakdown: null } });
  },

  pasteMeal: async (date) => {
    const { mealClipboard: slice, plan } = get();
    if (slice === null) return; // empty clipboard: a quiet no-op (L5)
    const target = plan.find((entry) => entry.date === date);
    if (target?.locked === true) return; // a lock protects its day from paste too
    set((s) => ({
      plan:
        target !== undefined
          ? s.plan.map((entry) => (entry.date === date ? { ...entry, ...slice } : entry))
          : s.plan,
      dayMeals: target !== undefined ? s.dayMeals : { ...s.dayMeals, [date]: slice.recipeId },
    }));
    await quietly(() => mealsStore.writeDay(date, slice));
  },
}));
