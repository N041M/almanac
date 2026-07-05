import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, addDays, startOfWeek } from '@almanac/core';
import type { Task } from '@almanac/tasks';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useCalendars, DEFAULT_CALENDAR_ID } from '../state/calendars';
import { useMeals } from '../state/meals';
import { useSettings } from '../state/settings';
import { useTasks, syncReminders } from '../state/tasks';
import { DEFAULT_LIST_ID, useTaskLists } from '../state/task-lists';
import { useUndo } from '../state/undo';
import { today } from '../clock';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  await i18n.changeLanguage('en');
  useCalendar.setState({
    locale: EN_US,
    view: 'month',
    anchor: today(),
    selected: null,
    days: {},
    starred: {},
  });
  useMeals.setState({
    loaded: false,
    loading: false,
    viewWeek: startOfWeek(today(), 1),
    recipes: {},
    ingredients: {},
    items: [],
    settings: null,
    plan: [],
    breakdownIndex: null,
    nutritionChoices: {},
    nutritionPick: {},
    dayMeals: {},
    mealClipboard: null,
  });
  useTasks.setState({ loaded: false, loading: false, items: [] });
  useCalendars.setState({
    loaded: false,
    calendars: [{ id: DEFAULT_CALENDAR_ID, name: '', hue: 220, visible: true }],
  });
  useSettings.setState({
    loaded: false,
    weekStartsOn: null,
    timeFormat: null,
    remindersEnabled: false,
    reminderOffsetMin: 10,
  });
  useTaskLists.setState({ loaded: false, lists: [{ id: DEFAULT_LIST_ID, name: '' }] });
  useUndo.setState({ stack: [], toastKey: null });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('P6 — multiple calendars', () => {
  it('add a calendar, file an entry on it, hide it — a view filter, never deletion', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Create a "Work" calendar in Settings.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.type(screen.getByLabelText('New calendar name'), 'Work');
    await user.click(screen.getByRole('button', { name: 'Add calendar' }));
    expect(await screen.findByText('Work')).toBeInTheDocument();

    // File a task on it via the composer's calendar select.
    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    await user.type(await screen.findByLabelText(/What needs doing/), 'quarterly report');
    const workId = useCalendars.getState().calendars.find((c) => c.name === 'Work')?.id ?? '';
    await user.selectOptions(screen.getByLabelText('Calendar'), workId);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('quarterly report')).toBeInTheDocument();
    expect(useTasks.getState().items[0]?.calendarId).toBe(workId);

    // Hide Work: the task leaves the list…
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByLabelText('Show Work'));
    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    expect(screen.queryByText('quarterly report')).not.toBeInTheDocument();
    // …but the item is still stored (never deletion).
    expect(useTasks.getState().items).toHaveLength(1);
  });

  it('an unknown calendarId renders on the default calendar (L5)', () => {
    const orphan: Task = {
      kind: 'task',
      id: 'x',
      title: 'orphan',
      calendarId: 'deleted-calendar',
      categories: [],
      contexts: [],
      doneAt: null,
    };
    useTasks.setState({ loaded: true, items: [orphan] });
    expect(useCalendars.getState().calendarOf('deleted-calendar').id).toBe(DEFAULT_CALENDAR_ID);
    const map = useTasks.getState().occurrences(today(), today());
    expect(map.size).toBe(0); // no due date — but nothing crashed, item visible in lists
  });
});

describe('P6 — multiple to-do lists', () => {
  it('creates lists, files tasks into the active one, moves between lists, deletes back to Inbox', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    await screen.findByLabelText(/What needs doing/);

    // New "Groceries" list; make it active; add a task into it.
    await user.type(screen.getByLabelText('New list…'), 'Groceries{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Groceries' }));
    await user.type(screen.getByLabelText(/What needs doing/), 'buy milk{Enter}');
    await screen.findByText('buy milk');
    const milkId = useTasks.getState().items[0]?.id ?? '';
    const groceriesId = useTaskLists.getState().lists.find((l) => l.name === 'Groceries')?.id;
    expect(useTasks.getState().items[0]?.listId).toBe(groceriesId);

    // Inbox shows nothing; All shows it.
    await user.click(screen.getByRole('button', { name: 'Inbox' }));
    expect(screen.queryByText('buy milk')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(await screen.findByText('buy milk')).toBeInTheDocument();

    // Move it to Inbox via the row select.
    await user.selectOptions(screen.getByLabelText('Move buy milk to list'), 'inbox');
    expect(useTasks.getState().items[0]?.listId).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Inbox' }));
    expect(await screen.findByText('buy milk')).toBeInTheDocument();

    // Move it back, then delete the list: the task degrades to Inbox (L5).
    await useTasks.getState().moveToList(milkId, groceriesId ?? '');
    await user.click(screen.getByRole('button', { name: 'Groceries' }));
    await user.click(screen.getByRole('button', { name: 'Delete list' }));
    expect(useTaskLists.getState().lists).toHaveLength(1); // Inbox only
    await user.click(screen.getByRole('button', { name: 'Inbox' }));
    expect(await screen.findByText('buy milk')).toBeInTheDocument(); // still here
    expect(useTasks.getState().items).toHaveLength(1);
  });
});

describe('P6 — command palette', () => {
  it('⌘K opens; a natural-language date becomes a jump command', async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });

    await user.type(within(palette).getByRole('textbox'), 'tomorrow');
    const jump = await within(palette).findByText(`Go to ${addDays(today(), 1)}`);
    await user.click(jump);

    expect(useCalendar.getState().selected).toBe(addDays(today(), 1));
    expect(useCalendar.getState().view).toBe('day');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches views and toggles calendar visibility from the keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const palette = await screen.findByRole('dialog');
    await user.type(within(palette).getByRole('textbox'), 'agenda');
    fireEvent.keyDown(within(palette).getByRole('textbox'), { key: 'Enter' });
    expect(useCalendar.getState().view).toBe('agenda');

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const palette2 = await screen.findByRole('dialog');
    await user.type(within(palette2).getByRole('textbox'), 'hide calendar');
    fireEvent.keyDown(within(palette2).getByRole('textbox'), { key: 'Enter' });
    expect(useCalendars.getState().calendars[0]?.visible).toBe(false);
  });
});

describe('P6 — events from the composer', () => {
  it('a timed event lands on the calendar day it belongs to', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    await user.type(await screen.findByLabelText(/What needs doing/), 'team offsite');
    await user.click(screen.getByRole('radio', { name: 'Event' }));
    fireEvent.change(screen.getByLabelText('Due date'), {
      target: { value: addDays(today(), 2) },
    });
    fireEvent.change(screen.getByLabelText('Due time'), { target: { value: '10:00' } });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const item = useTasks.getState().items[0];
    expect(item?.kind).toBe('event');
    // events don't clutter the task lists…
    expect(screen.queryByText('team offsite')).not.toBeInTheDocument();
    // …they live on the calendar.
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    const cell = document.getElementById(`day-${addDays(today(), 2)}`) as HTMLElement;
    expect(await within(cell).findByText(/team offsite/)).toBeInTheDocument();
  });
});

describe('P6 — reminders ride the notification port', () => {
  it('an enabled reminder fires a Notification at due − offset; done cancels', () => {
    vi.useFakeTimers();
    const shown: string[] = [];
    class FakeNotification {
      static permission = 'granted';
      constructor(title: string) {
        shown.push(title);
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
    useSettings.setState({ remindersEnabled: true, reminderOffsetMin: 10 });

    const inAnHour = new Date(Date.now() + 60 * 60_000);
    const task: Task = {
      kind: 'task',
      id: 'r1',
      title: 'standup prep',
      categories: [],
      contexts: [],
      doneAt: null,
      due: {
        date: today(),
        minutes: inAnHour.getHours() * 60 + inAnHour.getMinutes(),
      },
    };
    syncReminders([task]);
    vi.advanceTimersByTime(65 * 60_000);
    expect(shown).toEqual(['standup prep']);

    // Done → the reminder is cancelled quietly.
    syncReminders([task]);
    syncReminders([{ ...task, doneAt: today() }]);
    vi.advanceTimersByTime(120 * 60_000);
    expect(shown).toHaveLength(1);
  });
});
