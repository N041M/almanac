import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, intensityForPriority } from '@almanac/core';
import type { Task, TaskItem } from '@almanac/tasks';
import { useCalendar } from '../state/store';
import { useTasks } from '../state/tasks';
import { DEFAULT_CALENDAR_ID, useCalendars } from '../state/calendars';
import { DEFAULT_LIST_ID, useTaskLists } from '../state/task-lists';
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
  const moveToList = useTasks((s) => s.moveToList);
  const lists = useTaskLists((s) => s.lists);
  const listOf = useTaskLists((s) => s.listOf);

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
    <li className="group flex items-start gap-3 px-2 py-2">
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
            <span className="border border-line px-1 text-[10px] text-ink-muted">
              {/* 1–3 keep their named labels; higher numbers show as "P5" (D9). */}
              {item.priority <= 3
                ? t(`priority${item.priority}`)
                : t('priorityN', { n: item.priority })}
            </span>
          )}
          {chips.map((chip) => (
            <span key={chip} className="px-1.5 py-0.5 text-xs" style={tagStyle(chip)}>
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
      {lists.length > 1 && (
        <select
          aria-label={t('moveToList', { title: item.title })}
          value={listOf(item.listId).id}
          onChange={(e) => void moveToList(item.id, e.target.value)}
          className="max-w-28 border border-line bg-surface-raised px-1.5 py-0.5 text-xs text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.id === DEFAULT_LIST_ID ? t('inbox') : list.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        aria-label={t('remove')}
        onClick={() => void removeItem(item.id)}
        className="shrink-0 px-1.5 text-ink-muted opacity-0 transition hover:text-ink group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        ✕
      </button>
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
  const loadLists = useTaskLists((s) => s.load);
  const lists = useTaskLists((s) => s.lists);
  const addList = useTaskLists((s) => s.add);
  const removeList = useTaskLists((s) => s.remove);
  const [activeList, setActiveList] = useState<string>('all');
  const [newList, setNewList] = useState('');

  useEffect(() => {
    void load();
    void loadCalendars();
    void loadLists();
  }, [load, loadCalendars, loadLists]);
  if (!loaded) return null;

  // A deleted list's tasks degrade to Inbox — resolve ids, never compare raw (L5).
  const listIds = new Set(lists.map((l) => l.id));
  const effectiveList = (item: TaskItem): string => {
    const id = item.listId ?? DEFAULT_LIST_ID;
    return listIds.has(id) ? id : DEFAULT_LIST_ID;
  };
  const inList = (item: TaskItem): boolean =>
    activeList === 'all' || effectiveList(item) === activeList;

  // Hidden calendars filter lists too (§8) — a view filter, never deletion.
  const visible = (item: TaskItem): boolean =>
    (calendars.find((c) => c.id === (item.calendarId ?? DEFAULT_CALENDAR_ID)) ??
      calendars.find((c) => c.id === DEFAULT_CALENDAR_ID))?.visible !== false;

  const isTask = (item: TaskItem): item is Task => item.kind === 'task';
  const open = items
    .filter(isTask)
    .filter((task) => task.doneAt === null && visible(task) && inList(task));
  const done = items
    .filter(isTask)
    .filter((task) => task.doneAt !== null && visible(task) && inList(task));
  // Dated first (soonest due), undated after — the standard list order.
  open.sort((a, b) => (a.due?.date ?? '9999').localeCompare(b.due?.date ?? '9999'));

  return (
    <div className="space-y-6">
      {/* To-do lists: quiet switcher; the composer files into the active one. */}
      <nav aria-label={t('lists')} className="flex flex-wrap items-center gap-1 text-sm">
        {[{ id: 'all', name: t('allLists') }, ...lists].map((list) => (
          <button
            key={list.id}
            type="button"
            aria-current={activeList === list.id ? 'true' : undefined}
            onClick={() => setActiveList(list.id)}
            className={[
              'px-2 py-1 transition-colors',
              'focus-visible:outline-2 focus-visible:outline-accent',
              activeList === list.id
                ? 'font-medium text-accent underline decoration-2 underline-offset-4'
                : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {list.id === DEFAULT_LIST_ID ? t('inbox') : list.name}
          </button>
        ))}
        {activeList !== 'all' && activeList !== DEFAULT_LIST_ID && (
          <Button variant="ghost" className="text-xs" onClick={() => {
            void removeList(activeList);
            setActiveList('all');
          }}>
            {t('deleteList')}
          </Button>
        )}
        <form
          className="ml-auto"
          onSubmit={(e) => {
            e.preventDefault();
            void addList(newList);
            setNewList('');
          }}
        >
          <input
            aria-label={t('newList')}
            placeholder={t('newList')}
            value={newList}
            onChange={(e) => setNewList(e.target.value)}
            className="w-32 border border-line bg-surface-raised px-2 py-1 text-xs text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </form>
      </nav>
      <TaskComposer {...(activeList !== 'all' && { listId: activeList })} />

      <section className="border border-line bg-surface-raised p-2 shadow-sm">
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
        <section className="border border-line bg-surface-raised p-2 shadow-sm">
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
