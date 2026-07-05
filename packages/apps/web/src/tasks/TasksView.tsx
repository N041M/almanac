import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, intensityForPriority } from '@almanac/core';
import type { Task, TaskItem } from '@almanac/tasks';
import { useCalendar } from '../state/store';
import { useTasks } from '../state/tasks';
import { DEFAULT_CALENDAR_ID, useCalendars } from '../state/calendars';
import { Button } from '../ui/Button';
import { TaskComposer } from './TaskComposer';
import { tagStyle } from './tag-color';

function minutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * One task row: done toggle, title, colored tag chips, priority badge, due,
 * and — when present — a quiet description line. Every field degrades to
 * simply not being there (L5).
 */
function TaskRow({ item }: { item: Task }) {
  const { t } = useTranslation('tasks');
  const locale = useCalendar((s) => s.locale);
  const toggleDone = useTasks((s) => s.toggleDone);
  const removeItem = useTasks((s) => s.removeItem);

  const dueFormat = new Intl.DateTimeFormat(bcp47(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const done = item.doneAt !== null;
  const chips = [...item.categories, ...item.contexts.map((c) => `@${c}`)];
  const calendars = useCalendars((s) => s.calendars);
  const calendar = useCalendars((s) => s.calendarOf)(item.calendarId);

  return (
    <li className="flex items-start gap-3 px-2 py-2">
      <input
        type="checkbox"
        checked={done}
        aria-label={done ? t('reopen') : t('done')}
        onChange={() => void toggleDone(item.id)}
        className="mt-0.5 accent-accent"
      />
      <span className="min-w-0 flex-1">
        <span
          className={[
            'flex flex-wrap items-center gap-1.5 text-sm',
            done ? 'text-ink-muted line-through' : '',
          ].join(' ')}
          style={{ opacity: intensityForPriority(item.priority) }}
        >
          {calendars.length > 1 && (
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: `hsl(${calendar.hue} 65% 50%)` }}
            />
          )}
          {item.title}
          {item.priority !== undefined && (
            <span className="rounded border border-line px-1 text-[10px] text-ink-muted">
              {t(`priority${item.priority}`)}
            </span>
          )}
          {chips.map((chip) => (
            <span key={chip} className="rounded px-1.5 py-0.5 text-xs" style={tagStyle(chip)}>
              {chip}
            </span>
          ))}
        </span>
        {item.notes !== undefined && (
          <span className="mt-0.5 block truncate text-xs text-ink-muted">{item.notes}</span>
        )}
      </span>
      {item.due !== undefined && (
        <span className="shrink-0 pt-0.5 text-xs capitalize text-ink-muted">
          {dueFormat.format(dateFromISO(item.due.date))}
          {item.due.minutes !== undefined && ` · ${minutesLabel(item.due.minutes)}`}
        </span>
      )}
      <Button variant="ghost" onClick={() => void removeItem(item.id)}>
        {t('remove')}
      </Button>
    </li>
  );
}

/** The tasks screen (§8 v1): keyboard-first quick entry + open/done lists. */
export function TasksView() {
  const { t } = useTranslation('tasks');
  const loaded = useTasks((s) => s.loaded);
  const load = useTasks((s) => s.load);
  const items = useTasks((s) => s.items);
  const loadCalendars = useCalendars((s) => s.load);
  const calendars = useCalendars((s) => s.calendars);

  useEffect(() => {
    void load();
    void loadCalendars();
  }, [load, loadCalendars]);
  if (!loaded) return null;

  // Hidden calendars filter lists too (§8) — a view filter, never deletion.
  const visible = (item: TaskItem): boolean =>
    (calendars.find((c) => c.id === (item.calendarId ?? DEFAULT_CALENDAR_ID)) ??
      calendars.find((c) => c.id === DEFAULT_CALENDAR_ID))?.visible !== false;

  const isTask = (item: TaskItem): item is Task => item.kind === 'task';
  const open = items.filter(isTask).filter((task) => task.doneAt === null && visible(task));
  const done = items.filter(isTask).filter((task) => task.doneAt !== null && visible(task));
  // Dated first (soonest due), undated after — the standard list order.
  open.sort((a, b) => (a.due?.date ?? '9999').localeCompare(b.due?.date ?? '9999'));

  return (
    <div className="space-y-6">
      <TaskComposer />

      <section className="rounded-2xl border border-line bg-surface-raised p-2 shadow-sm">
        {open.length === 0 ? (
          <p className="px-2 py-4 text-sm text-ink-muted">{t('noTasksYet')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {open.map((task) => (
              <TaskRow key={task.id} item={task} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface-raised p-2 shadow-sm">
          <h3 className="px-2 pt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {t('completed')}
          </h3>
          <ul className="divide-y divide-line">
            {done.map((task) => (
              <TaskRow key={task.id} item={task} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
