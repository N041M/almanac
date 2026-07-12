import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, type ISODate } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { useTasks } from '../state/tasks';
import { dayMealEntries } from '../state/meals-day';
import { slotLabel } from '../state/meal-slot-label';
import { useModuleVisible } from '../state/module-visibility';
import { CheckinSection } from '../checkin/CheckinSection';
import { CycleSection } from '../cycle/CycleSection';
import { BodySection } from '../body/BodySection';
import { WorkoutsSection } from '../workouts/WorkoutsSection';
import { WeatherLine } from '../weather/WeatherLine';
import { ageOn, birthdaysOn } from '@almanac/birthdays';
import { useBirthdays } from '../state/birthdays';
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
  // The day's planned meals, one per filled slot (the plan is authoritative
  // for its dates; other dates come from the read-through cache). A `null`
  // name = a meal whose recipe no longer exists.
  const plan = useMeals((s) => s.plan);
  const dayMeals = useMeals((s) => s.dayMeals);
  const recipes = useMeals((s) => s.recipes);
  const slots = useMeals((s) => s.slots);
  // Hidden modules contribute nothing here — the same posture as absent (L5).
  const mealsVisible = useModuleVisible('meals');
  const tasksVisible = useModuleVisible('tasks');
  const checkinVisible = useModuleVisible('checkin');
  const cycleVisible = useModuleVisible('cycle');
  const bodyVisible = useModuleVisible('body');
  const workoutsVisible = useModuleVisible('workouts');
  const weatherVisible = useModuleVisible('weather');
  const birthdaysVisible = useModuleVisible('birthdays');
  const birthdayEntries = useBirthdays((s) => s.entries);
  const loadBirthdays = useBirthdays((s) => s.load);
  const dayBirthdays = birthdaysVisible ? birthdaysOn(birthdayEntries, date) : [];
  const entry = plan.find((e) => e.date === date);
  const slice = entry !== undefined ? { slots: entry.slots } : dayMeals[date];
  const plannedMeals = !mealsVisible
    ? []
    : dayMealEntries(slice, slots.map((slot) => slot.id)).map(({ slotId, recipeId }) => ({
        slotId,
        name: recipes[recipeId]?.name ?? null,
      }));

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
    void loadBirthdays();
  }, [load, loadDayMeal, loadTasks, loadBirthdays, date]);

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
      {weatherVisible && <WeatherLine date={date} />}
      {dayBirthdays.map((birthday) => {
        const age = ageOn(birthday, date);
        return (
          <p key={birthday.id} className="text-sm">
            {age === null
              ? t('birthdays:chip', { name: birthday.name })
              : t('birthdays:chipWithAge', { name: birthday.name, age })}
          </p>
        );
      })}
      {plannedMeals.length > 0 && (
        <ul className="space-y-1 text-sm">
          {plannedMeals.map(({ slotId, name }) => {
            const slot = slots.find((s) => s.id === slotId);
            const label =
              slot === undefined
                ? t('meals:plannedMeal')
                : slotLabel(slot, (key) => t(`meals:${key}`));
            return (
              <li key={slotId}>
                <span className="text-ink-muted">{label}: </span>
                {name ?? t('meals:removedMeal')}
              </li>
            );
          })}
        </ul>
      )}
      {tasksVisible && dayTasks.length > 0 && (
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
      {plannedMeals.length === 0 && (!tasksVisible || dayTasks.length === 0) && (
        <p className="text-sm text-ink-muted">{t('noEntries')}</p>
      )}
      {/* Day actions live here too — no tab hunt needed (P6 UX). */}
      {tasksVisible && (
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
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void toggleStar(date)}>
          {isStarred ? t('unstar') : t('star')}
        </Button>
        {plannedMeals.length > 0 && (
          <Button onClick={() => copyMeal(date)}>{t('meals:copyMeal')}</Button>
        )}
        {mealsVisible && hasClipboard && (
          <Button onClick={() => void pasteMeal(date)}>{t('meals:pasteMeal')}</Button>
        )}
      </div>
      {checkinVisible && <CheckinSection date={date} />}
      {cycleVisible && <CycleSection date={date} />}
      {bodyVisible && <BodySection date={date} />}
      {workoutsVisible && <WorkoutsSection date={date} />}
    </div>
  );
}
