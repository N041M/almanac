import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, bcp47, dateFromISO, isValidISODate, startOfWeek, type ISODate } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { Button } from '../ui/Button';
import { MealWeekList } from './MealWeekList';
import { MealBreakdown } from './MealBreakdown';
import { MealsManager } from './MealsManager';
import { today } from '../clock';

/**
 * Variety as three honest choices instead of a 0–1 slider; the engine keeps
 * its continuous contract (§6.4) — this is purely a UI simplification.
 * "Balanced" is the sweet spot the design doc names.
 */
const VARIETY_PRESETS = [
  { key: 'varietyPredictable', value: 0.15 },
  { key: 'varietyBalanced', value: 0.5 },
  { key: 'varietySurprising', value: 0.85 },
] as const;

/** Stored variety (possibly a legacy slider value) → the nearest preset. */
function closestVariety(variety: number): number {
  return VARIETY_PRESETS.reduce((best, preset) =>
    Math.abs(preset.value - variety) < Math.abs(best.value - variety) ? preset : best,
  ).value;
}

/** This Monday — the week the tab always comes back to. */
function currentMonday(): string {
  return startOfWeek(today(), 1);
}

/**
 * The meals module's screen (§6 UX): the 7-day plan with lock/re-roll, the
 * variety control, generate/commit, the "why this pick" panel, and the meal
 * manager. All engine calls flow through the meals state — the view renders.
 */
export function MealsView() {
  const { t } = useTranslation('meals');
  const locale = useCalendar((s) => s.locale);
  const loaded = useMeals((s) => s.loaded);
  const load = useMeals((s) => s.load);
  const settings = useMeals((s) => s.settings);
  const items = useMeals((s) => s.items);
  const viewWeek = useMeals((s) => s.viewWeek);
  const goToWeek = useMeals((s) => s.goToWeek);
  const resetToCurrentWeek = useMeals((s) => s.resetToCurrentWeek);
  const generate = useMeals((s) => s.generate);
  const commit = useMeals((s) => s.commit);
  const updateSettings = useMeals((s) => s.updateSettings);

  // Opening the tab always lands on the current week (stale context is the
  // enemy); navigation below moves freely from there.
  useEffect(() => {
    void load().then(() => resetToCurrentWeek());
  }, [load, resetToCurrentWeek]);

  if (!loaded || settings === null) return null;

  const weekFormat = new Intl.DateTimeFormat(bcp47(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const weekLabel = weekFormat.formatRange(
    dateFromISO(viewWeek),
    dateFromISO(addDays(viewWeek, 6)),
  );
  const onCurrentWeek = viewWeek === currentMonday();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex items-center gap-1">
          <Button variant="ghost" aria-label={t('prevWeek')} onClick={() => void goToWeek(addDays(viewWeek, -7))}>
            ‹
          </Button>
          <Button variant="ghost" aria-label={t('nextWeekNav')} onClick={() => void goToWeek(addDays(viewWeek, 7))}>
            ›
          </Button>
          <h2 className="text-base font-semibold">{weekLabel}</h2>
          {!onCurrentWeek && (
            <Button variant="ghost" onClick={() => void resetToCurrentWeek()}>
              {t('thisWeek')}
            </Button>
          )}
          <input
            type="date"
            aria-label={t('pickWeek')}
            value={viewWeek}
            onChange={(e) => {
              if (isValidISODate(e.target.value)) void goToWeek(e.target.value as ISODate);
            }}
            className="rounded-lg border border-line bg-surface-raised px-2 py-1 text-xs text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>
        {/* Deliberately quiet — a tertiary tweak, styled like the language selector. */}
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          {t('variety')}
          <select
            aria-label={t('variety')}
            value={closestVariety(settings.variety)}
            onChange={(e) => void updateSettings({ variety: Number(e.target.value) })}
            className="rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {VARIETY_PRESETS.map(({ key, value }) => (
              <option key={key} value={value}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="solid" onClick={() => void generate()} disabled={items.length === 0}>
          {t('generateWeek')}
        </Button>
        <Button onClick={() => void commit()}>{t('nextWeek')}</Button>
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(14rem,2fr)]">
        <div className="rounded-2xl border border-line bg-surface-raised p-2 shadow-sm">
          <MealWeekList />
        </div>
        <aside className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-ink-muted">{t('whyThisPick')}</h3>
          <MealBreakdown />
        </aside>
      </section>

      <section className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        <MealsManager />
      </section>
    </div>
  );
}
