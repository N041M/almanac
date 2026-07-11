import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, addDays } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useBody } from '../state/body';
import { bodyStore } from '../state/body-services';
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
  useBody.setState({ loaded: false, loading: false, days: {} });
});

async function openToday(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('gridcell', { current: 'date' }));
  return within(await screen.findByRole('region', { name: 'Body' }));
}

describe('body & weight trend (§8) — typed entries, derived trend', () => {
  it('logs weight and body fat; the day slice persists both', async () => {
    const user = userEvent.setup();
    const section = await openToday(user);

    await user.type(section.getByLabelText('Weight (kg)'), '80.4');
    await user.keyboard('{Enter}');
    await user.type(section.getByLabelText('Body fat (%)'), '21');
    await user.keyboard('{Enter}');

    const stored = globalThis.localStorage.getItem(`day:${today()}:body`) ?? '';
    expect(stored).toContain('"weightKg":80.4');
    expect(stored).toContain('"bodyFatPct":21');
  });

  it('a typo is reverted quietly, never stored (L5)', async () => {
    const user = userEvent.setup();
    const section = await openToday(user);

    await user.type(section.getByLabelText('Weight (kg)'), '8000');
    await user.keyboard('{Enter}');
    expect(globalThis.localStorage.getItem(`day:${today()}:body`)).toBeNull();
    expect(section.getByLabelText('Weight (kg)')).toHaveValue('');
  });

  it('enough history surfaces the smoothed trend and weekly rate', async () => {
    // Ten daily entries drifting down.
    for (let i = 10; i >= 1; i--) {
      await bodyStore.writeDay(addDays(today(), -i), {
        weightKg: 80 - (10 - i) * 0.1,
        bodyFatPct: null,
      });
    }
    const user = userEvent.setup();
    const section = await openToday(user);

    expect(await section.findByText(/Trend .* kg/)).toBeInTheDocument();
    expect(section.getByText(/kg\/week/)).toBeInTheDocument();
  });

  it('a single entry shows the trend seed but claims no rate (L5)', async () => {
    const user = userEvent.setup();
    const section = await openToday(user);
    await user.type(section.getByLabelText('Weight (kg)'), '80');
    await user.keyboard('{Enter}');

    expect(await section.findByText('Trend 80 kg')).toBeInTheDocument();
    expect(section.queryByText(/kg\/week/)).not.toBeInTheDocument();
  });
});
