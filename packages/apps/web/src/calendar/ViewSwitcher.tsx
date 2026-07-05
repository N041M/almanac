import { useTranslation } from 'react-i18next';
import type { CalendarView } from '../state/store';
import { useCalendar } from '../state/store';

const VIEWS: { view: CalendarView; labelKey: string }[] = [
  { view: 'month', labelKey: 'viewMonth' },
  { view: 'week', labelKey: 'viewWeek' },
  { view: 'timeline', labelKey: 'viewTimeline' },
  { view: 'day', labelKey: 'viewDay' },
  { view: 'agenda', labelKey: 'viewAgenda' },
];

/** Segmented view control (5.4: Month · Week · Timeline · Day · Agenda). */
export function ViewSwitcher() {
  const { t } = useTranslation();
  const active = useCalendar((s) => s.view);
  const setView = useCalendar((s) => s.setView);

  return (
    <div role="group" className="inline-flex overflow-hidden rounded-lg border border-line">
      {VIEWS.map(({ view, labelKey }) => (
        <button
          key={view}
          aria-pressed={view === active}
          onClick={() => setView(view)}
          className={[
            'px-3 py-1 text-sm transition-colors',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
            view === active ? 'bg-accent-soft font-medium' : 'hover:bg-accent-soft/50',
          ].join(' ')}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
