import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, type ISODate } from '@almanac/core';
import {
  MAX_PLAUSIBLE_WEIGHT_KG,
  MIN_PLAUSIBLE_WEIGHT_KG,
  weeklyRateKg,
  weightTrend,
} from '@almanac/body';
import { useCalendar } from '../state/store';
import { useBody } from '../state/body';

/** Parse a user-typed number ("80,4" included); null = cleared or unusable. */
function parseEntry(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * The body log (§8) on the day's detail surface: weight and (optional) body
 * fat, both typed by the user, plus the smoothed trend and weekly rate once
 * the history carries them. The trend is the number worth watching — the
 * daily reading is noise (water, food timing).
 */
export function BodySection({ date }: { date: ISODate }) {
  const { t } = useTranslation('body');
  const locale = useCalendar((s) => s.locale);
  const days = useBody((s) => s.days);
  const load = useBody((s) => s.load);
  const update = useBody((s) => s.update);
  const slice = days[date] ?? { weightKg: null, bodyFatPct: null };

  const [weightDraft, setWeightDraft] = useState('');
  const [fatDraft, setFatDraft] = useState('');

  useEffect(() => {
    void load();
  }, [load]);
  // Follow the loaded values (async read); while typing, the stored values
  // don't move, so drafts are never clobbered mid-edit.
  useEffect(() => {
    setWeightDraft(slice.weightKg === null ? '' : String(slice.weightKg));
  }, [date, slice.weightKg]);
  useEffect(() => {
    setFatDraft(slice.bodyFatPct === null ? '' : String(slice.bodyFatPct));
  }, [date, slice.bodyFatPct]);

  const { trendKg, rate } = useMemo(() => {
    const entries = Object.entries(days)
      .filter(([, s]) => s.weightKg !== null)
      .map(([d, s]) => ({ date: d, weightKg: s.weightKg ?? 0 }));
    const points = weightTrend(entries);
    return {
      trendKg: points[points.length - 1]?.trendKg ?? null,
      rate: weeklyRateKg(points),
    };
  }, [days]);

  const tag = bcp47(locale);
  const one = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const signed = new Intl.NumberFormat(tag, {
    maximumFractionDigits: 2,
    signDisplay: 'always',
  });

  function commitWeight(): void {
    const value = parseEntry(weightDraft);
    // Implausible values are typos: revert the draft, change nothing (L5).
    if (value !== null && (value < MIN_PLAUSIBLE_WEIGHT_KG || value > MAX_PLAUSIBLE_WEIGHT_KG)) {
      setWeightDraft(slice.weightKg === null ? '' : String(slice.weightKg));
      return;
    }
    if (value !== slice.weightKg) void update(date, { weightKg: value });
  }

  function commitFat(): void {
    const value = parseEntry(fatDraft);
    if (value !== null && (value <= 0 || value >= 100)) {
      setFatDraft(slice.bodyFatPct === null ? '' : String(slice.bodyFatPct));
      return;
    }
    if (value !== slice.bodyFatPct) void update(date, { bodyFatPct: value });
  }

  const inputClass =
    'w-20 rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <section aria-label={t('title')} className="space-y-2.5 border-t border-line pt-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('title')}</h4>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2 text-ink-muted">
          {t('weight')}
          <input
            aria-label={t('weight')}
            inputMode="decimal"
            value={weightDraft}
            onChange={(e) => setWeightDraft(e.target.value)}
            onBlur={commitWeight}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitWeight();
            }}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-ink-muted">
          {t('bodyFat')}
          <input
            aria-label={t('bodyFat')}
            inputMode="decimal"
            value={fatDraft}
            onChange={(e) => setFatDraft(e.target.value)}
            onBlur={commitFat}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitFat();
            }}
            className={inputClass}
          />
        </label>
      </div>
      {trendKg !== null && (
        <p className="text-xs text-ink-muted">
          <span className="mr-2">{t('trendKg', { value: one.format(trendKg) })}</span>
          {rate !== null && <span>{t('ratePerWeek', { value: signed.format(rate) })}</span>}
        </p>
      )}
    </section>
  );
}
