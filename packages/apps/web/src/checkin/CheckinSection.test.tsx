import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EN_US } from '@almanac/core';
import { App } from '../App';
import { useCalendar } from '../state/store';
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
  useCheckin.setState({ slices: {} });
});

describe('daily check-in (§8) — one quick log on the day detail', () => {
  it('logs mood, energy, a symptom, and a note; the day slice persists it all', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    const section = within(await screen.findByRole('region', { name: 'Check-in' }));

    await user.click(section.getByRole('button', { name: 'Set Mood to 4' }));
    await user.click(section.getByRole('button', { name: 'Set Energy to 2' }));
    await user.type(section.getByLabelText('Add a symptom'), 'headache{Enter}');
    await user.type(section.getByLabelText('Note'), 'long day');
    await user.tab(); // blur persists the note

    expect(section.getByRole('button', { name: 'Clear Mood' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(section.getByText('headache')).toBeInTheDocument();

    const stored = globalThis.localStorage.getItem(`day:${today()}:checkin`) ?? '';
    expect(stored).toContain('"mood":4');
    expect(stored).toContain('"energy":2');
    expect(stored).toContain('headache');
    expect(stored).toContain('long day');
  });

  it('clears a rating by clicking it again — not logged is a normal state (L5)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    const section = within(await screen.findByRole('region', { name: 'Check-in' }));

    await user.click(section.getByRole('button', { name: 'Set Mood to 5' }));
    await user.click(section.getByRole('button', { name: 'Clear Mood' }));
    expect(section.getByRole('button', { name: 'Set Mood to 5' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(globalThis.localStorage.getItem(`day:${today()}:checkin`) ?? '').toContain(
      '"mood":null',
    );
  });

  it('a corrupt stored slice degrades to the empty log, quietly (L5)', async () => {
    globalThis.localStorage.setItem(`day:${today()}:checkin`, '{ not json');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('gridcell', { current: 'date' }));
    const section = within(await screen.findByRole('region', { name: 'Check-in' }));

    // Every control renders in its empty state; nothing throws, nothing nags.
    expect(section.getByRole('button', { name: 'Set Mood to 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(section.getByLabelText('Note')).toHaveValue('');
  });
});
