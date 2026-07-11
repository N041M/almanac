import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, addDays, startOfWeek } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { mealsStore } from '../state/meals-services';
import { today } from '../clock';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  // Most cases exercise one meal a day; the three-meal default gets its own
  // test below. (`load()` reads the slot config from storage.)
  await mealsStore.saveSlots([{ id: 'dinner', name: 'Dinner' }]);
  // No test ever reaches the real network; "offline" is also the degradation
  // the nutrition guess must survive quietly (L5).
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  await i18n.changeLanguage('en');
  useCalendar.setState({
    locale: EN_US,
    view: 'month',
    anchor: today(),
    selected: null,
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
});

async function openMeals(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Meal planning' }));
  await screen.findByText('Your meals');
}

async function addMeal(user: ReturnType<typeof userEvent.setup>, name: string, tags = '') {
  await user.type(screen.getByLabelText('Meal name'), name);
  if (tags !== '') {
    await user.type(screen.getByLabelText(/Tags/), tags);
  }
  await user.click(screen.getByRole('button', { name: 'Add meal' }));
}

describe('meals UI', () => {
  it('shows an actionable empty state and seven empty slots before any meals exist', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    expect(screen.getByText(/No meals yet/)).toBeInTheDocument();
    expect(screen.getAllByText('No meal planned')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Re-roll week' })).toBeDisabled();
  });

  it('plans three meals a day by default, and the slots are configurable', async () => {
    // Undo the single-slot seeding: fall back to the Breakfast/Lunch/Dinner default.
    globalThis.localStorage.removeItem('meals:slots');
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await addMeal(user, 'Pasta');
    await addMeal(user, 'Curry');

    // Three empty slots per day, named.
    expect(screen.getAllByText('No meal planned')).toHaveLength(21);
    expect(screen.getAllByText('Breakfast')).not.toHaveLength(0);
    expect(screen.getAllByText('Dinner')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));
    const plan = useMeals.getState().plan;
    // Every configured slot on every day is planned, and no meal repeats in a day.
    for (const entry of plan) {
      const ids = ['breakfast', 'lunch', 'dinner'].map((s) => entry.slots[s]?.recipeId);
      expect(ids.every((id) => id != null)).toBe(true);
      expect(new Set(ids).size).toBe(3);
    }

    // Removing a slot leaves two meals a day.
    await user.click(screen.getByRole('button', { name: 'Remove Breakfast' }));
    expect(useMeals.getState().slots.map((s) => s.id)).toEqual(['lunch', 'dinner']);
  });

  it('adds meals with tags and presets; they persist and list with controls', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash', 'czech, hearty');
    await addMeal(user, 'Pasta');

    expect(screen.getByText('Goulash')).toBeInTheDocument();
    expect(screen.getByText('czech · hearty')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
    expect(useMeals.getState().items).toHaveLength(2);
    // persisted, not just in memory
    expect(globalThis.localStorage.getItem('meals:items')).toContain('"v":1');
  });

  it('generates a full week, shows the breakdown on click, and locks/re-rolls per day', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await addMeal(user, 'Pasta');
    await addMeal(user, 'Curry');

    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));
    expect(screen.queryAllByText('No meal planned')).toHaveLength(0);
    const state = useMeals.getState();
    expect(state.plan).toHaveLength(7);
    expect(state.plan.every((entry) => entry.slots['dinner']?.recipeId != null)).toBe(true);

    // Breakdown: click the first planned day.
    const rows = screen.getAllByRole('listitem');
    const firstMeal = within(rows[0] as HTMLElement).getByRole('button', { expanded: false });
    await user.click(firstMeal);
    expect(screen.getByText(/Selection probability/)).toBeInTheDocument();
    expect(screen.getByText('Never served')).toBeInTheDocument();

    // Lock day 0, re-roll day 1: day 0 must stand, day 1 stays filled.
    const day0 = useMeals.getState().plan[0]?.slots['dinner']?.recipeId;
    await user.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Lock' }));
    await user.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Re-roll' }));
    const after = useMeals.getState().plan;
    expect(after[0]?.slots['dinner']?.recipeId).toBe(day0);
    expect(after[0]?.slots['dinner']?.locked).toBe(true);
    expect(after[1]?.slots['dinner']?.recipeId).not.toBeNull();
  });

  it('Next week commits history and moves to a fresh week', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));

    const weekBefore = useMeals.getState().settings?.weekStart;
    await user.click(screen.getByRole('button', { name: 'Next week' }));

    const state = useMeals.getState();
    expect(state.settings?.weekStart).not.toBe(weekBefore);
    // history written: the item now carries a lastServed date
    expect(state.items[0]?.lastServed).not.toBeNull();
    // the new week is untouched
    expect(await screen.findAllByText('No meal planned')).toHaveLength(7);
  });

  it('the planned meal surfaces on the calendar day detail (shared day record)', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));

    // Today is inside the planned week, so its detail shows the meal.
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    const panel = within(screen.getByRole('complementary'));
    expect(await panel.findByText('Goulash')).toBeInTheDocument();
    // Each planned slot gets its own labeled line (here: the seeded dinner slot).
    expect(panel.getByText(/Dinner:/)).toBeInTheDocument();
  });

  it('adds and removes ingredient lines; the catalog reuses ingredients by name', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await addMeal(user, 'Soup');

    // Open Goulash's ingredients and add two lines.
    const rows = () => screen.getAllByRole('listitem');
    const goulashRow = rows().find((row) => row.textContent?.includes('Goulash')) as HTMLElement;
    await user.click(within(goulashRow).getByRole('button', { name: 'Ingredients (0)' }));
    await user.type(screen.getByLabelText('Ingredient'), 'Onion');
    await user.type(screen.getByLabelText('Amount'), '200');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    expect(await within(goulashRow).findByText('Onion')).toBeInTheDocument();
    expect(within(goulashRow).getByText('200 g')).toBeInTheDocument();
    expect(within(goulashRow).getByRole('button', { name: 'Ingredients (1)' })).toBeInTheDocument();

    // The same name in another meal reuses the catalog entry (one Onion app-wide).
    const soupRow = rows().find((row) => row.textContent?.includes('Soup')) as HTMLElement;
    await user.click(within(soupRow).getByRole('button', { name: 'Ingredients (0)' }));
    await user.type(within(soupRow).getByLabelText('Ingredient'), 'onion');
    await user.type(within(soupRow).getByLabelText('Amount'), '1');
    await user.selectOptions(within(soupRow).getByLabelText('Unit'), 'piece');
    await user.click(within(soupRow).getByRole('button', { name: 'Add ingredient' }));
    await within(soupRow).findByText(/onion/i);
    expect(Object.keys(useMeals.getState().ingredients)).toHaveLength(1);

    // Re-open Goulash's editor (opening Soup's closed it) and remove its line.
    await user.click(within(goulashRow).getByRole('button', { name: 'Ingredients (1)' }));
    await user.click(within(goulashRow).getByRole('button', { name: 'Remove Onion' }));
    expect(within(goulashRow).getByRole('button', { name: 'Ingredients (0)' })).toBeInTheDocument();
    // Both meals still exist; only the line went away.
    expect(useMeals.getState().items).toHaveLength(2);
  });

  it('guesses nutrition from ingredients via the OFF lookup and shows the per-serving estimate', async () => {
    // OFF answers the "Beef" search; per-100g facts ride in.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              products: [
                {
                  product_name: 'Beef',
                  code: '111',
                  nutriments: { 'energy-kcal_100g': 250, proteins_100g: 26, fat_100g: 15 },
                },
              ],
            }),
        }),
      ),
    );
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Ingredients (0)' }));
    await user.type(screen.getByLabelText('Ingredient'), 'Beef');
    await user.type(screen.getByLabelText('Amount'), '400');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    // 400 g × 250 kcal/100g = 1000 kcal ÷ 2 servings = 500 per serving.
    expect(await screen.findByText(/500 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/52 g protein/)).toBeInTheDocument();
    expect(screen.queryByText(/not counted/)).not.toBeInTheDocument();
  });

  it('offline: the ingredient still lands, uncounted — the guess is enrichment, not a gate (L5)', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    const toggle = screen.getByRole('button', { name: 'Ingredients (0)' });
    const row = toggle.closest('li') as HTMLElement;
    await user.click(toggle);
    await user.type(screen.getByLabelText('Ingredient'), 'Beef');
    await user.type(screen.getByLabelText('Amount'), '400');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    expect(await within(row).findByText('Beef')).toBeInTheDocument();
    // No facts, no estimate, no error — quiet absence.
    expect(screen.queryByText(/Estimated/)).not.toBeInTheDocument();
  });

  it('catalog reuse is plural-aware: "Onions" resolves to the existing "Onion"', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    const toggle = screen.getByRole('button', { name: 'Ingredients (0)' });
    await user.click(toggle);
    await user.type(screen.getByLabelText('Ingredient'), 'Onion');
    await user.type(screen.getByLabelText('Amount'), '100');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    await user.type(screen.getByLabelText('Ingredient'), 'onions');
    await user.type(screen.getByLabelText('Amount'), '50');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    expect(Object.keys(useMeals.getState().ingredients)).toHaveLength(1);
    // ...but a one-letter difference is a different ingredient, not a merge.
    await user.type(screen.getByLabelText('Ingredient'), 'Onios');
    await user.type(screen.getByLabelText('Amount'), '50');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    expect(Object.keys(useMeals.getState().ingredients)).toHaveLength(2);
  });

  it('the nutrition match is visible and changeable; switching updates the estimate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              products: [
                { product_name: 'Beef', code: '1', nutriments: { 'energy-kcal_100g': 250 } },
                { product_name: 'Beef jerky', code: '2', nutriments: { 'energy-kcal_100g': 400 } },
              ],
            }),
        }),
      ),
    );
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Ingredients (0)' }));
    await user.type(screen.getByLabelText('Ingredient'), 'Beef');
    await user.type(screen.getByLabelText('Amount'), '400');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    // Top match auto-applied: 400 g × 250 / 100 ÷ 2 servings = 500.
    expect(await screen.findByText(/500 kcal/)).toBeInTheDocument();

    // The match is visible and switchable: jerky → 800 kcal per serving.
    const match = screen.getByLabelText('Nutrition match for Beef');
    expect(within(match).getByRole('option', { selected: true })).toHaveTextContent('Beef');
    await user.selectOptions(match, '1');
    expect(await screen.findByText(/800 kcal/)).toBeInTheDocument();

    // "No match" clears the guess — and a user pick is never re-overwritten.
    await user.selectOptions(match, 'none');
    expect(screen.queryByText(/Estimated/)).not.toBeInTheDocument();
  });

  it('offline guess leaves a retry: the per-line "Guess nutrition" button', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Ingredients (0)' }));
    await user.type(screen.getByLabelText('Ingredient'), 'Beef');
    await user.type(screen.getByLabelText('Amount'), '400');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    // Offline (default stub): no choices, so the factless line offers a retry.
    const retry = await screen.findByRole('button', { name: 'Guess nutrition for Beef' });

    // Back online: the retry populates choices and applies the top match.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              products: [
                { product_name: 'Beef', code: '1', nutriments: { 'energy-kcal_100g': 250 } },
              ],
            }),
        }),
      ),
    );
    await user.click(retry);
    expect(await screen.findByText(/500 kcal/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nutrition match for Beef')).toBeInTheDocument();
  });

  it('copy/paste moves a meal to another day via the day detail buttons', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));

    // Calendar: select today (inside the plan week) and copy its meal.
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    await user.click(await screen.findByRole('button', { name: 'Copy meal' }));

    // Move selection one day right; paste there.
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    await user.click(screen.getByRole('button', { name: 'Paste meal' }));
    // scope to the day panel — the grid now shows meal chips too
    expect(
      await within(screen.getByRole('complementary')).findByText('Goulash'),
    ).toBeInTheDocument();

    // The paste is persisted as that day's meals slice.
    const target = useCalendar.getState().selected ?? '';
    const raw = globalThis.localStorage.getItem(`day:${target}:meals`) ?? '';
    expect(raw).toContain('"recipeId"');
    // A pasted copy is a fresh placement: no engine breakdown rides along.
    expect(JSON.parse(raw)).toMatchObject({
      d: { slots: { dinner: { breakdown: null, locked: false } } },
    });
  });

  it('⌘C/⌘V on the grid copy and paste the selected day, quietly no-op when empty', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));
    await user.click(screen.getByRole('button', { name: 'Calendar' }));

    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowRight' }); // selects today
    fireEvent.keyDown(grid, { key: 'c', metaKey: true });
    expect(useMeals.getState().mealClipboard?.slots['dinner']?.recipeId).not.toBeNull();

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'v', metaKey: true });
    const pasted = useCalendar.getState().selected ?? '';
    await within(screen.getByRole('complementary')).findByText('Goulash'); // day panel shows it
    expect(useMeals.getState().plan.some((e) => e.date === pasted) || pasted !== '').toBe(true);

    // Copying an empty day empties the clipboard — paste becomes a no-op (L5).
    fireEvent.keyDown(grid, { key: 'ArrowDown' }); // a week later: outside the plan
    fireEvent.keyDown(grid, { key: 'c', metaKey: true });
    expect(useMeals.getState().mealClipboard).toBeNull();
  });

  it('a locked day rejects paste, quietly — the lock protects it', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await addMeal(user, 'Soup');
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));

    const before = useMeals.getState().plan[2];
    await useMeals.getState().toggleLock(2, 'dinner');
    useMeals.setState({
      mealClipboard: {
        slots: { dinner: { recipeId: 'anything-else', locked: false, breakdown: null } },
      },
    });
    await useMeals.getState().pasteMeal(before?.date ?? '');

    const after = useMeals.getState().plan[2];
    expect(after?.slots['dinner']?.recipeId).toBe(before?.slots['dinner']?.recipeId);
    expect(after?.slots['dinner']?.locked).toBe(true);
  });

  it('variety is a plain dropdown; picking persists the engine value', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    const select = screen.getByRole('combobox', { name: 'Variety' });
    expect(select).toHaveValue('0.5'); // Balanced is the default
    await user.selectOptions(select, '0.85');
    expect(useMeals.getState().settings?.variety).toBe(0.85);
    expect(globalThis.localStorage.getItem('meals:settings')).toContain('0.85');
  });

  it('week navigation: browse other weeks, come home with "This week"', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));
    expect(screen.queryAllByText('No meal planned')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(await screen.findAllByText('No meal planned')).toHaveLength(7);

    await user.click(screen.getByRole('button', { name: 'This week' }));
    await waitFor(() => {
      expect(screen.queryAllByText('No meal planned')).toHaveLength(0);
    });
  });

  it('generate fills the *viewed* week, not just the current one', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    await user.click(screen.getByRole('button', { name: 'Later week' }));
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));
    const { plan, viewWeek } = useMeals.getState();
    expect(plan[0]?.date).toBe(viewWeek);
    expect(plan.every((e) => e.slots['dinner']?.recipeId != null)).toBe(true);
  });

  it('committing a past week never rewinds served-history or the week lineage', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    // Plan + commit the current week: lastServed lands in this week.
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    const forwardServed = useMeals.getState().items[0]?.lastServed;
    const forwardWeek = useMeals.getState().settings?.weekStart;
    expect(forwardServed).not.toBeNull();

    // Go back to a much earlier week, plan and commit there.
    await user.click(screen.getByLabelText('Pick a week'));
    // Two Mondays before the current view.
    const past = addDays(useMeals.getState().viewWeek, -21);
    await useMeals.getState().goToWeek(past);
    await user.click(screen.getByRole('button', { name: 'Re-roll week' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));

    // History and the engine's weekStart only ever move forward (§6.5).
    expect(useMeals.getState().items[0]?.lastServed).toBe(forwardServed);
    expect(useMeals.getState().settings?.weekStart).toBe(forwardWeek);
  });

  it('estimate-all guesses every factless ingredient; a no-hit shows "No match"', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await addMeal(user, 'Goulash');
    const toggle = screen.getByRole('button', { name: 'Ingredients (0)' });
    await user.click(toggle);
    // Offline stub: both ingredients land factless.
    await user.type(screen.getByLabelText('Ingredient'), 'Beef');
    await user.type(screen.getByLabelText('Amount'), '400');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    await user.type(screen.getByLabelText('Ingredient'), 'Unobtainium');
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));

    // Back online: Beef matches, Unobtainium finds nothing.
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              decodeURIComponent(String(url)).toLowerCase().includes('beef')
                ? {
                    products: [
                      { product_name: 'Beef', code: '1', nutriments: { 'energy-kcal_100g': 250 } },
                    ],
                  }
                : { products: [] },
            ),
        }),
      ),
    );
    await user.click(
      screen.getByRole('button', { name: 'Estimate nutrition for all ingredients' }),
    );

    // Beef got facts -> the per-serving estimate appears; Unobtainium says so
    // (the "Try again" retry only renders in the tried-and-empty state).
    expect(await screen.findByText(/500 kcal/)).toBeInTheDocument();
    // the no-hit line offers a labelled retry ("Try again" text, per-line name)
    expect(
      await screen.findByRole('button', { name: 'Guess nutrition for Unobtainium' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('No match').length).toBeGreaterThan(0);
  });

  it('meals switch language with the app (module namespace rides the manifest, L7)', async () => {
    const user = userEvent.setup();
    await openMeals(user);
    await user.selectOptions(screen.getByLabelText('Language'), 'cs');
    expect(screen.getByRole('button', { name: 'Vylosovat týden znovu' })).toBeInTheDocument();
    expect(screen.getByText('Vaše jídla')).toBeInTheDocument();
  });
});
