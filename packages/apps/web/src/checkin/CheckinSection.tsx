import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISODate } from '@almanac/core';
import { RATING_MAX, RATING_MIN, type CheckinDaySlice } from '@almanac/checkin';
import { useCheckin } from '../state/checkin';

const EMPTY: CheckinDaySlice = { mood: null, energy: null, symptoms: [], note: '' };
const SCALE = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

function RatingRow({
  field,
  value,
  onChange,
}: {
  field: 'mood' | 'energy';
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const { t } = useTranslation('checkin');
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-16 shrink-0 text-sm text-ink-muted">{t(field)}</span>
      {SCALE.map((step) => {
        const active = value === step;
        return (
          <button
            key={step}
            type="button"
            aria-pressed={active}
            aria-label={
              active
                ? t('clearRating', { label: t(field) })
                : t('setRating', { label: t(field), value: step })
            }
            // Clicking the active value clears it — "not logged" is a normal state (L5).
            onClick={() => onChange(active ? null : step)}
            className={[
              'h-7 w-7 rounded-full text-xs tabular-nums transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              active
                ? 'bg-accent font-semibold text-white'
                : 'bg-accent-soft/60 text-ink-muted hover:bg-accent-soft',
            ].join(' ')}
          >
            {step}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The daily check-in (§8): one quick log — mood, energy, symptoms, a note —
 * on the day's detail surface. Nothing logged is the ordinary state; the
 * controls are the empty state, quietly actionable (L5).
 */
export function CheckinSection({ date }: { date: ISODate }) {
  const { t } = useTranslation('checkin');
  const slice = useCheckin((s) => s.slices[date]) ?? EMPTY;
  const load = useCheckin((s) => s.load);
  const update = useCheckin((s) => s.update);
  const addSymptom = useCheckin((s) => s.addSymptom);
  const removeSymptom = useCheckin((s) => s.removeSymptom);
  const [symptomText, setSymptomText] = useState('');
  const [noteDraft, setNoteDraft] = useState(slice.note);

  useEffect(() => {
    void load(date);
  }, [load, date]);
  // Follow the loaded note (async read); while typing, the stored note is
  // unchanged, so the draft is never clobbered mid-edit.
  useEffect(() => {
    setNoteDraft(slice.note);
  }, [date, slice.note]);

  return (
    <section aria-label={t('title')} className="space-y-2.5 border-t border-line pt-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('title')}</h4>
      <RatingRow field="mood" value={slice.mood} onChange={(v) => void update(date, { mood: v })} />
      <RatingRow
        field="energy"
        value={slice.energy}
        onChange={(v) => void update(date, { energy: v })}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {slice.symptoms.map((symptom) => (
          <span
            key={symptom}
            className="flex items-center gap-1 rounded-full bg-accent-soft/60 px-2 py-0.5 text-xs"
          >
            {symptom}
            <button
              type="button"
              aria-label={t('removeSymptom', { name: symptom })}
              onClick={() => void removeSymptom(date, symptom)}
              className="text-ink-muted hover:text-ink"
            >
              ✕
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addSymptom(date, symptomText);
            setSymptomText('');
          }}
        >
          <input
            aria-label={t('addSymptom')}
            placeholder={t('addSymptom')}
            value={symptomText}
            onChange={(e) => setSymptomText(e.target.value)}
            className="w-32 rounded-lg border border-line bg-surface-raised px-2 py-1 text-xs text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </form>
      </div>
      <textarea
        aria-label={t('note')}
        placeholder={t('notePlaceholder')}
        value={noteDraft}
        rows={2}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={() => {
          if (noteDraft !== slice.note) void update(date, { note: noteDraft });
        }}
        className="w-full resize-none rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
      />
    </section>
  );
}
