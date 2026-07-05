import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { allUnits } from '@almanac/core';
import { deriveRecipeNutrition } from '@almanac/food';
import { useMeals } from '../state/meals';
import { Button } from '../ui/Button';

/**
 * The ingredient lines of one meal: list + remove, an add row (name, amount,
 * unit from the core registry), and servings. Ingredient names resolve
 * through the shared catalog; an unknown id degrades to the id text (L5).
 */
export function MealIngredientsEditor({ recipeId }: { recipeId: string }) {
  const { t } = useTranslation('meals');
  const recipe = useMeals((s) => s.recipes[recipeId]);
  const ingredients = useMeals((s) => s.ingredients);
  const addIngredient = useMeals((s) => s.addIngredient);
  const removeIngredient = useMeals((s) => s.removeIngredient);
  const setServings = useMeals((s) => s.setServings);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('g');

  if (recipe === undefined) return null;

  const submit = () => {
    const value = Number(amount);
    if (name.trim() === '' || !Number.isFinite(value) || value <= 0) return;
    void addIngredient(recipeId, name, value, unit);
    setName('');
    setAmount('');
  };

  const inputClass =
    'rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-line bg-surface px-3 py-3">
      {recipe.ingredients.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('noIngredientsYet')}</p>
      ) : (
        <ul className="space-y-1">
          {recipe.ingredients.map((line, i) => {
            const lineName = ingredients[line.ingredientId]?.name ?? line.ingredientId;
            return (
              <li key={`${line.ingredientId}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{lineName}</span>
                <NutritionMatch ingredientId={line.ingredientId} name={lineName} />
                <span className="text-ink-muted">
                  {line.quantity.value} {line.quantity.unit}
                </span>
                <Button
                  variant="ghost"
                  aria-label={t('removeLine', { name: lineName })}
                  onClick={() => void removeIngredient(recipeId, i)}
                >
                  {t('remove')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          aria-label={t('ingredientName')}
          placeholder={t('ingredientName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          list={`ingredient-catalog-${recipeId}`}
          className={`min-w-32 flex-1 ${inputClass}`}
        />
        {/* Autocomplete from the shared catalog — picking a suggestion is how
            near-duplicates get avoided (confirm, don't fuzzy-merge). */}
        <datalist id={`ingredient-catalog-${recipeId}`}>
          {Object.values(ingredients)
            .map((entry) => entry.name)
            .sort((a, b) => a.localeCompare(b))
            .map((entry) => (
              <option key={entry} value={entry} />
            ))}
        </datalist>
        <input
          aria-label={t('amount')}
          placeholder={t('amount')}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`w-20 ${inputClass}`}
        />
        <select
          aria-label={t('unit')}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className={inputClass}
        >
          {allUnits().map((u) => (
            <option key={u.code} value={u.code}>
              {u.code}
            </option>
          ))}
        </select>
        <Button type="submit">{t('addIngredient')}</Button>
      </form>

      <label className="flex items-center gap-2 text-sm text-ink-muted">
        {t('servings')}
        <input
          aria-label={t('servings')}
          type="number"
          min={1}
          value={recipe.servings}
          onChange={(e) => void setServings(recipeId, Number(e.target.value))}
          className={`w-16 ${inputClass}`}
        />
      </label>

      <EstimateAll recipeId={recipeId} />
      <DerivedNutrition recipeId={recipeId} />
    </div>
  );
}

/** One button to guess every factless ingredient in the meal at once. */
function EstimateAll({ recipeId }: { recipeId: string }) {
  const { t } = useTranslation('meals');
  const recipe = useMeals((s) => s.recipes[recipeId]);
  const ingredients = useMeals((s) => s.ingredients);
  const guessAllNutrition = useMeals((s) => s.guessAllNutrition);
  const factless = (recipe?.ingredients ?? []).filter(
    (line) => ingredients[line.ingredientId]?.nutrition === undefined,
  );
  if (factless.length === 0) return null;
  return (
    <Button variant="ghost" className="text-xs" onClick={() => void guessAllNutrition(recipeId)}>
      {t('estimateAll')}
    </Button>
  );
}

/**
 * Which OFF product an ingredient's guessed facts come from — visible and
 * changeable, per the confirm-the-match practice. Three quiet states (L5):
 * choices in session → a select (top matches + "no match"); factless with no
 * choices → a "guess" button (also the retry after offline); facts from a
 * previous session → nothing extra.
 */
function NutritionMatch({ ingredientId, name }: { ingredientId: string; name: string }) {
  const { t } = useTranslation('meals');
  const ingredient = useMeals((s) => s.ingredients[ingredientId]);
  const choices = useMeals((s) => s.nutritionChoices[ingredientId]);
  const pick = useMeals((s) => s.nutritionPick[ingredientId]);
  const guessNutrition = useMeals((s) => s.guessNutrition);
  const applyNutrition = useMeals((s) => s.applyNutrition);

  if (choices !== undefined && choices.length === 0) {
    // Tried and found nothing — say so instead of pretending nothing happened.
    return (
      <span className="flex items-center gap-1 text-xs text-ink-muted">
        {t('noMatch')}
        <Button
          variant="ghost"
          className="text-xs"
          aria-label={t('guessFor', { name })}
          onClick={() => void guessNutrition(ingredientId)}
        >
          {t('tryAgain')}
        </Button>
      </span>
    );
  }
  if (choices !== undefined && choices.length > 0) {
    return (
      <select
        aria-label={t('nutritionMatch', { name })}
        value={pick ?? 'none'}
        onChange={(e) =>
          void applyNutrition(ingredientId, e.target.value === 'none' ? null : Number(e.target.value))
        }
        className="max-w-40 truncate rounded-lg border border-line bg-surface-raised px-2 py-1 text-xs text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
      >
        {choices.map((choice, i) => (
          <option key={`${choice.barcode ?? choice.name}-${i}`} value={i}>
            {choice.name}
          </option>
        ))}
        <option value="none">{t('noMatch')}</option>
      </select>
    );
  }
  if (ingredient !== undefined && ingredient.nutrition === undefined) {
    return (
      <Button
        variant="ghost"
        className="text-xs"
        aria-label={t('guessFor', { name })}
        onClick={() => void guessNutrition(ingredientId)}
      >
        {t('guessNutrition')}
      </Button>
    );
  }
  return null;
}

/**
 * The guessed per-serving macros, derived from ingredient facts (§7). Purely
 * additive: nothing derivable → nothing shown; partially derivable → shown
 * with a quiet "n not counted" hint, never a warning dialog (L5).
 */
function DerivedNutrition({ recipeId }: { recipeId: string }) {
  const { t } = useTranslation('meals');
  const recipe = useMeals((s) => s.recipes[recipeId]);
  const ingredients = useMeals((s) => s.ingredients);
  if (recipe === undefined || recipe.ingredients.length === 0) return null;

  const derived = deriveRecipeNutrition(recipe, new Map(Object.entries(ingredients)));
  const { perServing, unaccounted } = derived;
  const parts = [
    perServing.kcal !== undefined && t('nutrKcal', { value: Math.round(perServing.kcal) }),
    perServing.proteinG !== undefined &&
      t('nutrProtein', { value: Math.round(perServing.proteinG) }),
    perServing.carbsG !== undefined && t('nutrCarbs', { value: Math.round(perServing.carbsG) }),
    perServing.fatG !== undefined && t('nutrFat', { value: Math.round(perServing.fatG) }),
  ].filter((part): part is string => typeof part === 'string');
  if (parts.length === 0) return null;

  return (
    <p className="text-sm text-ink-muted">
      <span className="font-medium text-ink">{t('estimatedNutrition')}: </span>
      ≈ {parts.join(' · ')}
      {unaccounted.length > 0 && (
        <span className="ml-1">({t('nutritionPartial', { count: unaccounted.length })})</span>
      )}
    </p>
  );
}
