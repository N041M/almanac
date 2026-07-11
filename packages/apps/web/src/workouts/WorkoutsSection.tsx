import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISODate } from '@almanac/core';
import type { WorkoutSession } from '@almanac/workouts';
import { useWorkouts } from '../state/workouts';

/** Parse a small positive integer/decimal field; empty or junk ⇒ null (L5). */
function numOrNull(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function SessionCard({ date, session }: { date: ISODate; session: WorkoutSession }) {
  const { t } = useTranslation('workouts');
  const removeSession = useWorkouts((s) => s.removeSession);
  const addExercise = useWorkouts((s) => s.addExercise);
  const removeExercise = useWorkouts((s) => s.removeExercise);
  const [name, setName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');

  function submitExercise(): void {
    void addExercise(date, session.id, {
      name: name.trim(),
      sets: numOrNull(sets),
      reps: numOrNull(reps),
      weightKg: numOrNull(weight),
    });
    setName('');
    setSets('');
    setReps('');
    setWeight('');
  }

  const smallInput =
    'rounded-lg border border-line bg-surface-raised px-2 py-1 text-xs text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{session.title}</span>
        <button
          type="button"
          aria-label={t('removeSession', { name: session.title })}
          onClick={() => void removeSession(date, session.id)}
          className="text-xs text-ink-muted hover:text-ink"
        >
          ✕
        </button>
      </div>
      {session.exercises.length > 0 && (
        <ul className="space-y-1">
          {session.exercises.map((exercise, i) => (
            <li key={`${exercise.name}-${i}`} className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {exercise.sets !== null && exercise.reps !== null && (
                  <span className="mr-1.5">
                    {t('setLine', { sets: exercise.sets, reps: exercise.reps })}
                  </span>
                )}
                {exercise.weightKg !== null && (
                  <span>
                    {exercise.weightKg} {t('weightKg')}
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-label={t('removeExercise', { name: exercise.name })}
                onClick={() => void removeExercise(date, session.id, i)}
                className="shrink-0 text-xs text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitExercise();
        }}
        className="flex items-center gap-1.5"
      >
        <input
          aria-label={t('exerciseName')}
          placeholder={t('exerciseName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${smallInput} min-w-0 flex-1`}
        />
        <input
          aria-label={t('sets')}
          placeholder={t('sets')}
          inputMode="numeric"
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          className={`${smallInput} w-12`}
        />
        <input
          aria-label={t('reps')}
          placeholder={t('reps')}
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className={`${smallInput} w-12`}
        />
        <input
          aria-label={t('weightKg')}
          placeholder={t('weightKg')}
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className={`${smallInput} w-14`}
        />
        <button type="submit" className="sr-only">
          {t('addExercise')}
        </button>
      </form>
    </div>
  );
}

/**
 * The workout session log (§8) on the day's detail surface: sessions with
 * per-exercise set lines. A log of what happened — plan generation arrives
 * later as an optional layer writing the same slice. No sessions is the
 * ordinary state; the add field is the empty state (L5).
 */
export function WorkoutsSection({ date }: { date: ISODate }) {
  const { t } = useTranslation('workouts');
  const slice = useWorkouts((s) => s.slices[date]) ?? { sessions: [] };
  const load = useWorkouts((s) => s.load);
  const addSession = useWorkouts((s) => s.addSession);
  const [title, setTitle] = useState('');

  useEffect(() => {
    void load(date);
  }, [load, date]);

  return (
    <section aria-label={t('title')} className="space-y-2.5 border-t border-line pt-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('title')}</h4>
      {slice.sessions.map((session) => (
        <SessionCard key={session.id} date={date} session={session} />
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void addSession(date, title);
          setTitle('');
        }}
      >
        <input
          aria-label={t('addSession')}
          placeholder={t('addSession')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
      </form>
    </section>
  );
}
