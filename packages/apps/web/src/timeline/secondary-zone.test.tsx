import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useSettings } from '../state/settings';
import { today } from '../clock';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
  await i18n.changeLanguage('en');
  useCalendar.setState({
    locale: EN_US,
    view: 'timeline',
    anchor: today(),
    selected: null,
    days: {},
    starred: {},
  });
  useSettings.setState({
    loaded: false,
    weekStartsOn: null,
    timeFormat: null,
    secondaryZone: null,
    workStartHour: null,
    workEndHour: null,
    hiddenModules: [],
  });
});

describe('5.4 leftover — secondary time zone + working hours', () => {
  it('a valid zone adds the second column with the zone name', async () => {
    useSettings.setState({ loaded: true, secondaryZone: 'America/New_York' });
    render(<App />);
    expect(await screen.findByText('New York')).toBeInTheDocument();
  });

  it('an invalid zone renders no column, quietly (L5)', () => {
    useSettings.setState({ loaded: true, secondaryZone: 'Not/A_Zone' });
    render(<App />);
    expect(screen.getByText('All day')).toBeInTheDocument(); // grid intact
    expect(screen.queryByText('A Zone')).not.toBeInTheDocument();
  });

  it('the settings persist the zone and working hours', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    await user.type(screen.getByLabelText('Secondary time zone'), 'Europe/Prague');
    await user.tab();
    await user.selectOptions(screen.getByLabelText('Working hours start'), '9');
    await user.selectOptions(screen.getByLabelText('Working hours end'), '17');

    const stored = globalThis.localStorage.getItem('app:settings') ?? '';
    expect(stored).toContain('"secondaryZone":"Europe/Prague"');
    expect(stored).toContain('"workStartHour":9');
    expect(stored).toContain('"workEndHour":17');
  });
});
