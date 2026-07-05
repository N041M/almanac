import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, type ISODate } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { useTasks } from '../state/tasks';
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
  const plan = useMeals((s) => s.plan);
  const reroll = useMeals((s) => s.reroll);
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

  const loadTasks = useTasks((s) => s.load);
  const quickAdd = useTasks((s) => s.quickAdd);
  const [taskText, setTaskText] = useState('');
  const toggleDone = useTasks((s) => s.toggleDone);
  const occurrences = useTasks((s) => s.occurrences);
  useTasks((s) => s.items); // re-render on task changes
  const dayTasks = occurrences(date, date).get(date) ?? [];

  useEffect(() => {
    void load().then(() => loadDayMeal(date));
    void loadTasks();
  }, [load, loadDayMeal, loadTasks, date]);

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
      {plannedMeal !== undefined && (
        <p className="text-sm">
          <span className="text-ink-muted">{t('meals:plannedMeal')}: </span>
          {plannedMeal ?? t('meals:removedMeal')}
        </p>
      )}
      {dayTasks.length > 0 && (
        <ul className="space-y-1.5">
          {dayTasks.map((occurrence) => (
            <li key={occurrence.item.id} className="flex items-center gap-2 text-sm">
              {occurrence.item.kind === 'task' ? (
                <input
                  type="checkbox"
                  checked={occurrence.item.doneAt !== null}
                  aria-label={occurrence.item.title}
                  onChange={() => void toggleDone(occurrence.item.id)}
                  className="accent-accent"
                />
              ) : (
                <span aria-hidden="true">•</span>
              )}
              <span
                className={
                  occurrence.item.kind === 'task' && occurrence.item.doneAt !== null
                    ? 'text-ink-muted line-through'
                    : ''
                }
              >
                {occurrence.changes?.title ?? occurrence.item.title}
              </span>
            </li>
          ))}
        </ul>
      )}
      {plannedMeal === undefined && dayTasks.length === 0 && (
        <p className="text-sm text-ink-muted">{t('noEntries')}</p>
      )}
      {/* Day actions live here too — no tab hunt needed (P6 UX). */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (taskText.trim() === '') return;
          void quickAdd(taskText, { date });
          setTaskText('');
        }}
      >
        <input
          aria-label={t('tasks:addForDay')}
          placeholder={t('tasks:addForDay')}
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
      </form>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void toggleStar(date)}>
          {isStarred ? t('unstar') : t('star')}
        </Button>
        {(() => {
          const index = plan.findIndex((e) => e.date === date);
          const entry = index === -1 ? undefined : plan[index];
          if (entry?.recipeId == null || entry.locked) return null;
          return (
            <Button onClick={() => void reroll(index)}>{t('meals:rerollDay')}</Button>
          );
        })()}
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
