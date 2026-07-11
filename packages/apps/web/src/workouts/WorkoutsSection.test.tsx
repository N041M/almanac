import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useWorkouts } from '../state/workouts';
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
  useWorkouts.setState({ slices: {} });
});

async function openToday(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('gridcell', { current: 'date' }));
  return within(await screen.findByRole('region', { name: 'Workouts' }));
}

describe('workouts (§8) — the session log on the day detail', () => {
  it('logs a session with exercise set lines; the day slice persists it all', async () => {
    const user = userEvent.setup();
    const section = await openToday(user);

    await user.type(section.getByLabelText('Log a workout'), 'Push day{Enter}');
    expect(await section.findByText('Push day')).toBeInTheDocument();

    await user.type(section.getByLabelText('Exercise'), 'Bench press');
    await user.type(section.getByLabelText('Sets'), '3');
    await user.type(section.getByLabelText('Reps'), '8');
    await user.type(section.getByLabelText('kg'), '60{Enter}');

    expect(await section.findByText('Bench press')).toBeInTheDocument();
    expect(section.getByText('3×8')).toBeInTheDocument();
    expect(section.getByText('60 kg')).toBeInTheDocument();

    const stored = globalThis.localStorage.getItem(`day:${today()}:workouts`) ?? '';
    expect(stored).toContain('"title":"Push day"');
    expect(stored).toContain('"name":"Bench press"');
    expect(stored).toContain('"weightKg":60');
  });

  it('an exercise without counts still lands — numbers are optional (L5)', async () => {
    const user = userEvent.setup();
    const section = await openToday(user);
    await user.type(section.getByLabelText('Log a workout'), 'Run{Enter}');
    await section.findByText('Run');
    await user.type(section.getByLabelText('Exercise'), '5k easy{Enter}');
    expect(await section.findByText('5k easy')).toBeInTheDocument();
    expect(section.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('removes a session; an empty day is the ordinary state', async () => {
    const user = userEvent.setup();
    const section = await openToday(user);
    await user.type(section.getByLabelText('Log a workout'), 'Legs{Enter}');
    await section.findByText('Legs');

    await user.click(section.getByRole('button', { name: 'Remove Legs' }));
    await waitFor(() => expect(section.queryByText('Legs')).not.toBeInTheDocument());
    expect(globalThis.localStorage.getItem(`day:${today()}:workouts`) ?? '').toContain(
      '"sessions":[]',
    );
  });
});
