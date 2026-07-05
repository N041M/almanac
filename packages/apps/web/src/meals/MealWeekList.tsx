import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { Button } from '../ui/Button';
import { today } from '../clock';

/**
 * The seven planned days. Each row: day, meal (or an actionable empty slot),
 * lock and re-roll. Clicking a planned row opens its "why this pick" panel.
 */
export function MealWeekList() {
  const { t } = useTranslation('meals');
  const locale = useCalendar((s) => s.locale);
  const plan = useMeals((s) => s.plan);
  const recipes = useMeals((s) => s.recipes);
  const breakdownIndex = useMeals((s) => s.breakdownIndex);
  const showBreakdown = useMeals((s) => s.showBreakdown);
  const toggleLock = useMeals((s) => s.toggleLock);
  const reroll = useMeals((s) => s.reroll);

  const dayFormat = new Intl.DateTimeFormat(bcp47(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  });
  const isToday = today();

  return (
    <ol className="divide-y divide-line">
      {plan.map((entry, i) => {
        // A meal whose recipe was deleted degrades to a label, not a raw id.
        const name =
          entry.recipeId === null
            ? null
            : (recipes[entry.recipeId]?.name ?? t('removedMeal'));
        return (
          <li
            key={entry.date}
            className={[
              'flex items-center gap-3 px-2 py-2.5',
              entry.date === isToday ? 'bg-accent-soft/40' : '',
              breakdownIndex === i ? 'bg-accent-soft/60' : '',
            ].join(' ')}
          >
            <span className="w-24 shrink-0 text-sm capitalize text-ink-muted">
              {dayFormat.format(dateFromISO(entry.date))}
            </span>
            {name !== null ? (
              <button
                type="button"
                onClick={() => showBreakdown(breakdownIndex === i ? null : i)}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                aria-expanded={breakdownIndex === i}
              >
                {name}
                {entry.locked && <span aria-hidden="true"> 🔒</span>}
              </button>
            ) : (
              <span className="flex-1 text-sm text-ink-muted">{t('emptySlot')}</span>
            )}
            <Button
              variant="ghost"
              onClick={() => void toggleLock(i)}
              aria-pressed={entry.locked}
              disabled={entry.recipeId === null}
            >
              {entry.locked ? t('unlockDay') : t('lockDay')}
            </Button>
            <Button variant="ghost" onClick={() => void reroll(i)} disabled={entry.locked}>
              {t('rerollDay')}
            </Button>
          </li>
        );
      })}
    </ol>
  );
}
