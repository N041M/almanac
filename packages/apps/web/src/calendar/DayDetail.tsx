import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, type ISODate } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { Button } from '../ui/Button';

/**
 * The detail content for one day — the surface future module contributions
 * render into. Empty states are actionable, never blank (L5/§9).
 */
export function DayDetail({
  date,
  heading = true,
}: {
  date: ISODate;
  /** Off when the host already titles the day (e.g. the day view's header). */
  heading?: boolean;
}) {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const starred = useCalendar((s) => s.starred);
  const toggleStar = useCalendar((s) => s.toggleStar);
  // The meals contribution for this day: the loaded plan week, or any other
  // date via the read-through cache — an absent module or empty day simply
  // contributes nothing (L5).
  const load = useMeals((s) => s.load);
  const loadDayMeal = useMeals((s) => s.loadDayMeal);
  const copyMeal = useMeals((s) => s.copyMeal);
  const pasteMeal = useMeals((s) => s.pasteMeal);
  const hasClipboard = useMeals((s) => s.mealClipboard !== null);
  // The plan is authoritative for its dates — an empty slot there must not
  // fall through to the (possibly stale) out-of-week cache. `null` = a meal
  // whose recipe no longer exists.
  const plannedMeal = useMeals((s): string | null | undefined => {
    const entry = s.plan.find((e) => e.date === date);
    const recipeId = entry !== undefined ? entry.recipeId : (s.dayMeals[date] ?? null);
    if (recipeId === null) return undefined;
    return s.recipes[recipeId]?.name ?? null;
  });

  useEffect(() => {
    void load().then(() => loadDayMeal(date));
  }, [load, loadDayMeal, date]);

  const label = new Intl.DateTimeFormat(bcp47(locale), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromISO(date));
  const isStarred = starred[date] ?? false;

  return (
    <div className="space-y-4">
      {heading && <h3 className="font-semibold capitalize">{label}</h3>}
      {plannedMeal !== undefined ? (
        <p className="text-sm">
          <span className="text-ink-muted">{t('meals:plannedMeal')}: </span>
          {plannedMeal ?? t('meals:removedMeal')}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">{t('noEntries')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void toggleStar(date)}>
          {isStarred ? t('unstar') : t('star')}
        </Button>
        {plannedMeal !== undefined && (
          <Button onClick={() => copyMeal(date)}>{t('meals:copyMeal')}</Button>
        )}
        {hasClipboard && (
          <Button onClick={() => void pasteMeal(date)}>{t('meals:pasteMeal')}</Button>
        )}
      </div>
    </div>
  );
}
