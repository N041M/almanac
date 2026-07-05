import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, addDays, startOfWeek } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { useTasks } from '../state/tasks';
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
  useUndo.setState({ stack: [], toastKey: null });
});

async function openTasks(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Tasks' }));
  return await screen.findByLabelText(/What needs doing/);
}

describe('tasks UI (§8 v1)', () => {
  it('quick entry parses sigils + NL date/time; the task lists and persists', async () => {
    const user = userEvent.setup();
    const input = await openTasks(user);
    await user.type(input, 'buy milk tomorrow 14:00 #errands @store !2{Enter}');

    const row = (await screen.findByText('buy milk')).closest('li') as HTMLElement;
    expect(within(row).getByText('errands')).toBeInTheDocument();
    expect(within(row).getByText('@store')).toBeInTheDocument();
    expect(row).toHaveTextContent('14:00');

    const item = useTasks.getState().items[0];
    expect(item).toMatchObject({
      kind: 'task',
      title: 'buy milk',
      priority: 2,
      due: { date: addDays(today(), 1), minutes: 840 },
    });
    // persisted as a tasks entity record
    const key = `tasks:item:${item?.id ?? ''}`;
    expect(globalThis.localStorage.getItem(key)).toContain('"buy milk"');
  });

  it('unparseable text still creates the task — entry is never blocked (L5)', async () => {
    const user = userEvent.setup();
    const input = await openTasks(user);
    await user.type(input, 'someday maybe learn theremin{Enter}');
    expect(await screen.findByText('someday maybe learn theremin')).toBeInTheDocument();
    expect(useTasks.getState().items[0]).toMatchObject({ kind: 'task', doneAt: null });
  });

  it('done moves the task to Completed; removal tombstones; both undoable', async () => {
    const user = userEvent.setup();
    const input = await openTasks(user);
    await user.type(input, 'water plants{Enter}');
    await screen.findByText('water plants');

    await user.click(screen.getByRole('checkbox', { name: 'Done' }));
    expect(await screen.findByText('Completed')).toBeInTheDocument();

    // ⌘Z (via the store) reopens it.
    await useUndo.getState().undo();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();

    const id = useTasks.getState().items[0]?.id ?? '';
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('water plants')).not.toBeInTheDocument();
    // D6: the record remains as a tombstone, not a hard delete.
    expect(globalThis.localStorage.getItem(`tasks:item:${id}`)).toContain('"del":true');
    await useUndo.getState().undo();
    expect(await screen.findByText('water plants')).toBeInTheDocument();
  });

  it('pickers work without any shorthand — and win over parsed text', async () => {
    const user = userEvent.setup();
    const input = await openTasks(user);
    // Plain title; everything else via controls. The typed "!3" would say low,
    // but the explicit picker choice (High) wins.
    await user.type(input, 'file taxes !3');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Due time'), { target: { value: '09:30' } });
    await user.click(screen.getByRole('radio', { name: 'High' }));
    await user.type(screen.getByLabelText('Tags'), 'finance, @home');
    await user.click(screen.getByRole('button', { name: 'Description…' }));
    await user.type(screen.getByLabelText('Description'), 'use the new portal');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(useTasks.getState().items[0]).toMatchObject({
      title: 'file taxes',
      priority: 1,
      due: { date: '2026-08-01', minutes: 570 },
      categories: ['finance'],
      contexts: ['home'],
      notes: 'use the new portal',
    });
    // the row shows the differentiators: tag chips, priority badge, description
    const row = (await screen.findByText('file taxes')).closest('li') as HTMLElement;
    expect(within(row).getByText('finance')).toBeInTheDocument();
    expect(within(row).getByText('@home')).toBeInTheDocument();
    expect(within(row).getByText('High')).toBeInTheDocument();
    expect(within(row).getByText('use the new portal')).toBeInTheDocument();
  });

  it('the preview shows what the shorthand was understood as', async () => {
    const user = userEvent.setup();
    const input = await openTasks(user);
    await user.type(input, 'dentist tomorrow 9:00 #health');
    const preview = (await screen.findByText('Understood:')).parentElement as HTMLElement;
    expect(within(preview).getByText('9:00')).toBeInTheDocument();
    expect(within(preview).getByText('#health')).toBeInTheDocument();
  });

  it('a due task surfaces on the calendar: grid cell, day panel, agenda', async () => {
    const user = userEvent.setup();
    const input = await openTasks(user);
    await user.type(input, 'dentist tomorrow{Enter}');
    await screen.findByText('dentist');

    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    const tomorrow = document.getElementById(`day-${addDays(today(), 1)}`) as HTMLElement;
    expect(await within(tomorrow).findByText(/dentist/)).toBeInTheDocument();

    // day panel: selectable checkbox for the task
    await user.click(tomorrow);
    const panel = within(screen.getByRole('complementary'));
    expect(await panel.findByRole('checkbox', { name: 'dentist' })).toBeInTheDocument();

    // agenda lists it
    await user.click(screen.getByRole('button', { name: 'Agenda' }));
    expect(await screen.findByText(/dentist/)).toBeInTheDocument();
  });
});
