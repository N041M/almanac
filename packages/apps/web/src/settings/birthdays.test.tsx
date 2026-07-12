import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { useBirthdays } from '../state/birthdays';
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
  useBirthdays.setState({ loaded: false, entries: [] });
});

describe('birthdays (§8) — manual entries, yearly on the calendar', () => {
  it('adds a birthday in settings; it shows on the grid and the day detail with the age', async () => {
    const user = userEvent.setup();
    render(<App />);

    const [year, month, day] = today().split('-');
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const section = within(await screen.findByRole('region', { name: 'Birthdays' }));
    await user.type(section.getByLabelText('Name'), 'Anna');
    await user.type(section.getByLabelText('Day'), String(Number(day)));
    await user.type(section.getByLabelText('Month'), String(Number(month)));
    await user.type(section.getByLabelText('Year (optional)'), String(Number(year) - 30));
    await user.keyboard('{Enter}');
    expect(await section.findByText('Anna')).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('birthdays:entries') ?? '').toContain('"name":"Anna"');

    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    const grid = screen.getByRole('grid');
    expect(await within(grid).findByText('• 🎂 Anna (30)')).toBeInTheDocument();

    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    const panel = within(screen.getByRole('complementary'));
    expect(await panel.findByText('🎂 Anna (30)')).toBeInTheDocument();
  });

  it('a removed birthday leaves every surface; an impossible date never lands (L5)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const section = within(await screen.findByRole('region', { name: 'Birthdays' }));

    // Feb 30 does not exist — quiet no-op.
    await user.type(section.getByLabelText('Name'), 'Ghost');
    await user.type(section.getByLabelText('Day'), '30');
    await user.type(section.getByLabelText('Month'), '2');
    await user.keyboard('{Enter}');
    expect(useBirthdays.getState().entries).toHaveLength(0);

    const [, month, day] = today().split('-');
    await user.type(section.getByLabelText('Name'), 'Leo');
    await user.clear(section.getByLabelText('Day'));
    await user.type(section.getByLabelText('Day'), String(Number(day)));
    await user.clear(section.getByLabelText('Month'));
    await user.type(section.getByLabelText('Month'), String(Number(month)));
    await user.keyboard('{Enter}');
    await section.findByText('Leo');

    await user.click(section.getByRole('button', { name: 'Remove Leo' }));
    await waitFor(() => expect(section.queryByText('Leo')).not.toBeInTheDocument());
    expect(useBirthdays.getState().entries).toHaveLength(0);
  });
});
