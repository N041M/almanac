import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, startOfWeek } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { useSettings } from '../state/settings';
import { useCheckin } from '../state/checkin';
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
    breakdownCell: null,
    nutritionChoices: {},
    nutritionPick: {},
    dayMeals: {},
    mealClipboard: null,
  });
  useSettings.setState({ loaded: false, weekStartsOn: null, timeFormat: null, hiddenModules: [] });
  useCheckin.setState({ slices: {} });
});

/** Seed one meal ("Goulash") and place it on today via the clipboard. */
async function placeMealOnToday(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Meal planning' }));
  await screen.findByText('Your meals');
  await user.type(screen.getByLabelText('Meal name'), 'Goulash');
  await user.click(screen.getByRole('button', { name: 'Add meal' }));
  const recipeId = useMeals.getState().items[0]?.recipeId ?? '';
  useMeals.setState({
    mealClipboard: { slots: { dinner: { recipeId, locked: false, breakdown: null } } },
  });
  await useMeals.getState().pasteMeal(today());
  await user.click(screen.getByRole('button', { name: 'Calendar' }));
  await within(screen.getByRole('grid')).findByText('Goulash');
}

describe('module visibility — a settings view filter, never deletion (L5)', () => {
  it('hiding meals removes its tab and calendar contributions; showing restores them', async () => {
    const user = userEvent.setup();
    await placeMealOnToday(user);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByLabelText('Show Meal planning'));

    // The tab is gone and the setting persisted.
    expect(screen.queryByRole('button', { name: 'Meal planning' })).not.toBeInTheDocument();
    expect(globalThis.localStorage.getItem('app:settings') ?? '').toContain(
      '"hiddenModules":["meals"]',
    );

    // The calendar renders without the module — chip gone, data untouched.
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(within(screen.getByRole('grid')).queryByText('Goulash')).not.toBeInTheDocument();

    // Show it again: everything comes back.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByLabelText('Show Meal planning'));
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(await within(screen.getByRole('grid')).findByText('Goulash')).toBeInTheDocument();
  });

  it('standing on a module when it gets hidden bounces to the calendar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Tasks' }));
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    await useSettings.getState().setModuleHidden('tasks', true);
    await waitFor(() => expect(screen.getByRole('grid')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Tasks' })).not.toBeInTheDocument();
  });

  it('hiding check-in removes its day-detail section', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    expect(await screen.findByRole('region', { name: 'Check-in' })).toBeInTheDocument();

    await useSettings.getState().setModuleHidden('checkin', true);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Check-in' })).not.toBeInTheDocument(),
    );
  });
});
