import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US, addDays } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
import { today } from '../clock';
import i18n from '../i18n/config';

beforeEach(async () => {
  globalThis.localStorage.clear();
  await i18n.changeLanguage('en');
  useCalendar.setState({
    locale: EN_US,
    view: 'month',
    anchor: today(),
    selected: null,
    starred: {},
  });
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
    // the document language follows, so screen readers switch pronunciation
    expect(document.documentElement.lang).toBe('cs');
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

  it('arrow keys drive a roving selection on the grid (keyboard-first)', () => {
    render(<App />);
    const grid = screen.getByRole('grid');

    // First arrow press selects today; subsequent presses move day by day.
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    const todayCell = screen.getByRole('gridcell', { current: 'date' });
    expect(todayCell).toHaveAttribute('aria-selected', 'true');
    const todayId = todayCell.id.replace('day-', '');

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    const tomorrow = addDays(todayId, 1);
    expect(grid).toHaveAttribute('aria-activedescendant', `day-${tomorrow}`);
    expect(document.getElementById(`day-${tomorrow}`)).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(grid).toHaveAttribute('aria-activedescendant', `day-${addDays(tomorrow, 7)}`);
  });

  it('week view shows exactly the seven days and steps by a week', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Week' }));

    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(7);
    expect(screen.getByRole('gridcell', { current: 'date' })).toBeInTheDocument();

    const firstBefore = cells[0]?.id.replace('day-', '') ?? '';
    await user.click(screen.getByRole('button', { name: 'Next' }));
    const firstAfter = screen.getAllByRole('gridcell')[0]?.id.replace('day-', '') ?? '';
    expect(firstAfter).toBe(addDays(firstBefore, 7));
  });

  it('day view shows the day detail full-width (no sidebar hint, no grid)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Day' }));

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.queryByText('Select a day to see details.')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing planned yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Star this day' })).toBeInTheDocument();
  });

  it('degrades quietly when persistence fails: the star still works in-memory (L5)', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    try {
      const user = userEvent.setup();
      render(<App />);
      await user.click(screen.getByRole('gridcell', { current: 'date' }));
      await user.click(screen.getByRole('button', { name: 'Star this day' }));
      // No crash, no rejection — the UI reflects the action for this session.
      expect(await screen.findByLabelText('Starred day')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove star' })).toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });
});
