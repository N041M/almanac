import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBirthdays } from '../state/birthdays';

/** Parse a positive integer field; empty/junk ⇒ null. */
function intOrNull(text: string): number | null {
  const value = Number(text.trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Birthday management (§8): manual entries — name, day/month, optional year.
 * Contacts import arrives later behind a capability port; this list is the
 * module's full core behaviour.
 */
export function BirthdaysSection() {
  const { t } = useTranslation('birthdays');
  const entries = useBirthdays((s) => s.entries);
  const load = useBirthdays((s) => s.load);
  const add = useBirthdays((s) => s.add);
  const remove = useBirthdays((s) => s.remove);
  const [name, setName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  const inputClass =
    'rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <section
      aria-label={t('title')}
      className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm"
    >
      <h2 className="font-semibold">{t('title')}</h2>
      {entries.length > 0 && (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {String(entry.day).padStart(2, '0')}.{String(entry.month).padStart(2, '0')}.
                {entry.year ?? ''}
              </span>
              <button
                type="button"
                aria-label={t('removeBirthday', { name: entry.name })}
                onClick={() => void remove(entry.id)}
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
          const dayNum = intOrNull(day);
          const monthNum = intOrNull(month);
          if (dayNum === null || monthNum === null) return; // quiet no-op (L5)
          void add(name, monthNum, dayNum, intOrNull(year));
          setName('');
          setDay('');
          setMonth('');
          setYear('');
        }}
        className="flex flex-wrap items-center gap-1.5"
      >
        <input
          aria-label={t('personName')}
          placeholder={t('personName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <input
          aria-label={t('birthDay')}
          placeholder={t('birthDay')}
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className={`${inputClass} w-14`}
        />
        <input
          aria-label={t('birthMonth')}
          placeholder={t('birthMonth')}
          inputMode="numeric"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={`${inputClass} w-16`}
        />
        <input
          aria-label={t('birthYear')}
          placeholder={t('birthYear')}
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={`${inputClass} w-24`}
        />
        <button type="submit" className="sr-only">
          {t('addBirthday')}
        </button>
      </form>
    </section>
  );
}
