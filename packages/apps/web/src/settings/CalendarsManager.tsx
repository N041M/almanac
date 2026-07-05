import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_CALENDAR_ID, useCalendars } from '../state/calendars';
import { Button } from '../ui/Button';

const HUES = [220, 0, 30, 140, 280, 180];

/** Manage calendars (P6): name + color + per-calendar visibility toggle. */
export function CalendarsManager() {
  const { t } = useTranslation();
  const load = useCalendars((s) => s.load);
  const calendars = useCalendars((s) => s.calendars);
  const add = useCalendars((s) => s.add);
  const toggleVisible = useCalendars((s) => s.toggleVisible);
  const remove = useCalendars((s) => s.remove);

  const [name, setName] = useState('');
  const [hue, setHue] = useState(HUES[1] ?? 0);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
      <h2 className="font-semibold">{t('calendars')}</h2>
      <ul className="space-y-1.5">
        {calendars.map((calendar) => (
          <li key={calendar.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: `hsl(${calendar.hue} 65% 50%)` }}
            />
            <span className="flex-1">
              {calendar.id === DEFAULT_CALENDAR_ID ? t('defaultCalendarName') : calendar.name}
            </span>
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={calendar.visible}
                aria-label={t('calendarVisible', {
                  name: calendar.id === DEFAULT_CALENDAR_ID ? t('defaultCalendarName') : calendar.name,
                })}
                onChange={() => void toggleVisible(calendar.id)}
                className="accent-accent"
              />
              {t('shown')}
            </label>
            {calendar.id !== DEFAULT_CALENDAR_ID && (
              <Button variant="ghost" onClick={() => void remove(calendar.id)}>
                {t('removeCalendar')}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() === '') return;
          void add(name, hue);
          setName('');
        }}
      >
        <input
          aria-label={t('calendarName')}
          placeholder={t('calendarName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-36 flex-1 rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
        <div role="radiogroup" aria-label={t('calendarColor')} className="flex gap-1">
          {HUES.map((h, i) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={hue === h}
              aria-label={t('colorOption', { number: i + 1 })}
              onClick={() => setHue(h)}
              className={[
                'h-5 w-5 rounded-full border-2',
                hue === h ? 'border-ink' : 'border-transparent',
              ].join(' ')}
              style={{ backgroundColor: `hsl(${h} 65% 50%)` }}
            />
          ))}
        </div>
        <Button type="submit">{t('addCalendar')}</Button>
      </form>
    </section>
  );
}
