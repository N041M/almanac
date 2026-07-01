import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  await i18n.changeLanguage('en');
  useCalendar.setState({ locale: EN_US, selected: null, starred: {} });
});

describe('calendar shell', () => {
  it('renders the app title, 7 weekday headers, and a full month of cells', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Almanac');
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(screen.getAllByRole('gridcell').length).toBeGreaterThanOrEqual(28);
    // valid grid structure: a header row + 4–6 week rows
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(5);
  });

  it('switches language EN → CS (Today button relabels, L7 pipeline)', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Language'), 'cs');
    expect(screen.getByRole('button', { name: 'Dnes' })).toBeInTheDocument();
  });

  it('selecting today and starring it persists through the day store (end-to-end)', async () => {
    const user = userEvent.setup();
    render(<App />);

    // The empty state until a day is chosen.
    expect(screen.getByText('Select a day to see details.')).toBeInTheDocument();

    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    await user.click(screen.getByRole('button', { name: 'Star this day' }));

    // A starred marker now shows on the grid, read back from storage.
    expect(await screen.findByLabelText('Starred day')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove star' })).toBeInTheDocument();
  });
});
