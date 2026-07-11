import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISODate } from '@almanac/core';
import { parseQuickEntry } from '@almanac/tasks';
import { searchDocs, type SearchDoc } from '@almanac/search';
import { useCalendar, type CalendarView } from '../state/store';
import { useCalendars, DEFAULT_CALENDAR_ID } from '../state/calendars';
import { useTasks } from '../state/tasks';
import { useMeals } from '../state/meals';
import { useSettings } from '../state/settings';
import { collectSearchDocs } from '../state/search-sources';
import { today } from '../clock';

type Screen = 'calendar' | 'tasks' | 'meals' | 'shopping' | 'macros' | 'settings';

/** Search-doc kind → its i18n key (missing kinds fall back to the raw kind). */
const KIND_KEY: Record<string, string> = {
  task: 'kindTask',
  event: 'kindEvent',
  habit: 'kindHabit',
  recipe: 'kindRecipe',
  feed: 'kindFeed',
};

/** Where selecting a search result takes you: a dated hit jumps the calendar. */
function navigateToDoc(
  doc: SearchDoc,
  onNavigate: (screen: Screen) => void,
  select: (date: ISODate) => void,
  setView: (view: CalendarView) => void,
): void {
  if (doc.date !== undefined) {
    onNavigate('calendar');
    select(doc.date);
    setView('day');
    return;
  }
  onNavigate(doc.kind === 'recipe' || doc.kind === 'meal' ? 'meals' : 'tasks');
}

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/**
 * ⌘K command palette (P6): views, tabs, calendar visibility toggles, and
 * jump-to-date — the date field understands the same natural language as
 * quick entry ("tomorrow", "friday", "25.12."). No matches is a quiet empty
 * state, and Esc always leaves (L5).
 */
export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const setView = useCalendar((s) => s.setView);
  const select = useCalendar((s) => s.select);
  const calendars = useCalendars((s) => s.calendars);
  const toggleVisible = useCalendars((s) => s.toggleVisible);
  // Subscribe so results refresh as the underlying data changes.
  const taskItems = useTasks((s) => s.items);
  const recipes = useMeals((s) => s.recipes);
  // A hidden module has no tab command and isn't searchable — a source that
  // contributes nothing simply isn't there (L5).
  const hiddenModules = useSettings((s) => s.hiddenModules);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const commands = useMemo((): Command[] => {
    const views: { view: CalendarView; key: string }[] = [
      { view: 'month', key: 'viewMonth' },
      { view: 'week', key: 'viewWeek' },
      { view: 'timeline', key: 'viewTimeline' },
      { view: 'day', key: 'viewDay' },
      { view: 'agenda', key: 'viewAgenda' },
      { view: 'year', key: 'viewYear' },
    ];
    const list: Command[] = [
      // Jump-to-date, when the query reads as a date.
      ...(() => {
        const date = parseQuickEntry(query, today()).date;
        return date === undefined
          ? []
          : [
              {
                id: 'jump',
                label: t('jumpToDate', { date }),
                run: () => {
                  onNavigate('calendar');
                  select(date);
                  setView('day');
                },
              },
            ];
      })(),
      ...views.map(({ view, key }) => ({
        id: `view-${view}`,
        label: `${t('navCalendar')}: ${t(key)}`,
        run: () => {
          onNavigate('calendar');
          setView(view);
        },
      })),
      ...(['tasks', 'meals', 'shopping', 'macros'] as const)
        .filter((id) => !hiddenModules.includes(id))
        .map((id) => ({
          id: `tab-${id}`,
          label: t(`${id}:title`),
          run: () => onNavigate(id),
        })),
      { id: 'tab-settings', label: t('navSettings'), run: () => onNavigate('settings') },
      ...calendars.map((calendar) => ({
        id: `cal-${calendar.id}`,
        label: t(calendar.visible ? 'hideCalendar' : 'showCalendar', {
          name: calendar.id === DEFAULT_CALENDAR_ID ? t('defaultCalendarName') : calendar.name,
        }),
        run: () => void toggleVisible(calendar.id),
      })),
    ];
    const folded = query.trim().toLowerCase();
    if (folded === '') return list;

    const commandMatches = list.filter(
      (c) => c.id === 'jump' || c.label.toLowerCase().includes(folded),
    );
    // Findability (P8): fold ranked search hits in below the command matches.
    const hits: Command[] = searchDocs(
      collectSearchDocs(
        hiddenModules.includes('tasks') ? [] : taskItems,
        hiddenModules.includes('meals') ? {} : recipes,
      ),
      query,
    ).map((doc) => ({
      id: `hit-${doc.kind}-${doc.id}`,
      label: doc.title,
      hint: KIND_KEY[doc.kind] !== undefined ? t(KIND_KEY[doc.kind] as string) : doc.kind,
      run: () => navigateToDoc(doc, onNavigate, select, setView),
    }));
    return [...commandMatches, ...hits];
  }, [query, calendars, taskItems, recipes, hiddenModules, t, onNavigate, select, setView, toggleVisible]);

  if (!open) return null;

  function runCommand(command: Command | undefined): void {
    if (command === undefined) return; // nothing matched: quiet no-op
    command.run();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 p-4 pt-24"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={t('commandPalette')}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-xl"
      >
        <input
          ref={inputRef}
          aria-label={t('commandPalette')}
          placeholder={t('paletteHint')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, commands.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              runCommand(commands[active]);
            }
          }}
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {commands.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-muted">{t('paletteEmpty')}</li>
          )}
          {commands.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                onClick={() => runCommand(command)}
                onMouseEnter={() => setActive(i)}
                className={[
                  'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                  i === active ? 'bg-accent-soft' : '',
                ].join(' ')}
              >
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                {command.hint !== undefined && (
                  <span className="shrink-0 text-xs uppercase tracking-wide text-ink-muted">
                    {command.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
