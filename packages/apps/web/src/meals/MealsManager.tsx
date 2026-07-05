import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WEIGHT_PRESETS } from '@almanac/meals';
import { presetOf, useMeals, type WeightPreset } from '../state/meals';
import { Button } from '../ui/Button';
import { MealIngredientsEditor } from './MealIngredientsEditor';

const PRESET_KEYS: Record<WeightPreset, string> = {
  rare: 'weightRare',
  normal: 'weightNormal',
  often: 'weightOften',
  favourite: 'weightFavourite',
};

function PresetSelect({
  value,
  onChange,
  label,
}: {
  value: WeightPreset;
  onChange: (preset: WeightPreset) => void;
  label: string;
}) {
  const { t } = useTranslation('meals');
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as WeightPreset)}
      className="rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {(Object.keys(WEIGHT_PRESETS) as WeightPreset[]).map((preset) => (
        <option key={preset} value={preset}>
          {t(PRESET_KEYS[preset])}
        </option>
      ))}
    </select>
  );
}

/** Add + manage the dishes the planner draws from (recipes + plan items). */
export function MealsManager() {
  const { t } = useTranslation('meals');
  const recipes = useMeals((s) => s.recipes);
  const items = useMeals((s) => s.items);
  const addMeal = useMeals((s) => s.addMeal);
  const removeMeal = useMeals((s) => s.removeMeal);
  const updateItem = useMeals((s) => s.updateItem);

  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [preset, setPreset] = useState<WeightPreset>('normal');
  /** Which meal's ingredient editor is open. */
  const [openId, setOpenId] = useState<string | null>(null);

  const submit = () => {
    if (name.trim() === '') return;
    void addMeal(name, tags, preset);
    setName('');
    setTags('');
    setPreset('normal');
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('yourMeals')}</h3>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          aria-label={t('mealName')}
          placeholder={t('mealName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-40 flex-1 rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
        <input
          aria-label={t('mealTags')}
          placeholder={t('mealTags')}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="min-w-40 flex-1 rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
        <PresetSelect value={preset} onChange={setPreset} label={t('weight')} />
        <Button type="submit" variant="solid">
          {t('addMeal')}
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('noMealsYet')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const recipe = recipes[item.recipeId];
            const open = openId === item.recipeId;
            return (
              <li key={item.recipeId} className="py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-32 flex-1 text-sm font-medium">
                    {recipe?.name ?? item.recipeId}
                    {recipe !== undefined && recipe.tags.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        {recipe.tags.join(' · ')}
                      </span>
                    )}
                  </span>
                  <PresetSelect
                    value={presetOf(item.weight)}
                    onChange={(next) => void updateItem(item.recipeId, { weight: WEIGHT_PRESETS[next] })}
                    label={t('weight')}
                  />
                  <label className="flex items-center gap-1.5 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => void updateItem(item.recipeId, { enabled: e.target.checked })}
                      className="accent-accent"
                    />
                    {t('enabled')}
                  </label>
                  <Button
                    variant="ghost"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.recipeId)}
                  >
                    {t('ingredients', { count: recipe?.ingredients.length ?? 0 })}
                  </Button>
                  <Button variant="ghost" onClick={() => void removeMeal(item.recipeId)}>
                    {t('remove')}
                  </Button>
                </div>
                {open && <MealIngredientsEditor recipeId={item.recipeId} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
