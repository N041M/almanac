import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, addDays, startOfWeek } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { useSettings } from '../state/settings';
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
  useSettings.setState({ loaded: false, weekStartsOn: null, timeFormat: null });
  useUndo.setState({ stack: [], toastKey: null });
});

/** Seed one meal ("Goulash") and place it on today via the clipboard. */
async function placeMealOnToday(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Meal planning' }));
  await screen.findByText('Your meals');
  await user.type(screen.getByLabelText('Meal name'), 'Goulash');
  await user.click(screen.getByRole('button', { name: 'Add meal' }));
  const recipeId = useMeals.getState().items[0]?.recipeId ?? '';
  useMeals.setState({ mealClipboard: { recipeId, locked: false, breakdown: null } });
  await useMeals.getState().pasteMeal(today());
  await user.click(screen.getByRole('button', { name: 'Calendar' }));
  // the chip renders once the day records reload
  await within(screen.getByRole('grid')).findByText('Goulash');
}

/** A shared drag payload for jsdom (no native DataTransfer there). */
function dataTransfer() {
  const data: Record<string, string> = {};
  return {
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    getData: (type: string) => data[type] ?? '',
  };
}

describe('5.4 — day contributions on the grid + drag & drop', () => {
  it('drags the meal chip to another day; the entry moves', async () => {
    const user = userEvent.setup();
    await placeMealOnToday(user);

    const grid = screen.getByRole('grid');
    const chip = within(grid).getByText('Goulash');
    const target = document.getElementById(`day-${addDays(today(), 1)}`) as HTMLElement;

    const dt = dataTransfer();
    fireEvent.dragStart(chip, { dataTransfer: dt });
    fireEvent.drop(target, { dataTransfer: dt });

    expect(await within(target).findByText('Goulash')).toBeInTheDocument();
    const source = document.getElementById(`day-${today()}`) as HTMLElement;
    expect(within(source).queryByText('Goulash')).not.toBeInTheDocument();
  });

  it('⌘X cuts the selected day and ⌘Z restores it (undo, with toast)', async () => {
    const user = userEvent.setup();
    await placeMealOnToday(user);

    const grid = screen.getByRole('grid');
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    fireEvent.keyDown(grid, { key: 'x', metaKey: true });

    // gone from the grid; toast offers Undo
    await waitFor(() => {
      expect(within(grid).queryByText('Goulash')).not.toBeInTheDocument();
    });
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Cut meal');

    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(await within(grid).findByText('Goulash')).toBeInTheDocument();
  });

  it('the toast Undo button reverts a star', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    await user.click(screen.getByRole('button', { name: 'Star this day' }));
    expect(await screen.findByLabelText('Starred day')).toBeInTheDocument();

    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }));
    expect(screen.queryByLabelText('Starred day')).not.toBeInTheDocument();
  });
});

describe('5.4 — agenda + timeline views', () => {
  it('agenda lists upcoming contributions and empty state otherwise', async () => {
    const user = userEvent.setup();
    await placeMealOnToday(user);
    await user.click(screen.getByRole('button', { name: 'Agenda' }));
    expect(await screen.findByText('Goulash')).toBeInTheDocument();

    // moving two weeks ahead leaves the window empty — actionably (L5)
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/Nothing coming up/)).toBeInTheDocument();
  });

  it('timeline shows the all-day lane with the meal and an hour axis', async () => {
    const user = userEvent.setup();
    await placeMealOnToday(user);
    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(await screen.findByText('All day')).toBeInTheDocument();
    expect(screen.getByText('Goulash')).toBeInTheDocument();
  });
});

describe('5.5 — settings + vault', () => {
  it('week start override reorders the grid and persists', async () => {
    const user = userEvent.setup();
    render(<App />);
    // EN_US defaults to Sunday-first.
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent(/Sun/i);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(screen.getByLabelText('Week starts on'), '1');
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent(/Mon/i);
    expect(globalThis.localStorage.getItem('app:settings')).toContain('"weekStartsOn":1');
  });

  it('vault export/import round-trips the whole store', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    await user.click(screen.getByRole('button', { name: 'Star this day' }));

    const json = await useSettings.getState().exportVault();
    expect(json).toContain(`day:${today()}:demo`);

    globalThis.localStorage.clear();
    const result = await useSettings.getState().importVault(json);
    expect(result?.imported).toBeGreaterThan(0);
    expect(result?.skipped).toBe(0);
    expect(globalThis.localStorage.getItem(`day:${today()}:demo`)).toContain('starred');

    // a corrupt file imports nothing and reports it (L5)
    expect(await useSettings.getState().importVault('not json {')).toBeNull();
  });
});
