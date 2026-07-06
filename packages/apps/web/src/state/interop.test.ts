import { describe, it, expect, beforeEach } from 'vitest';
import type { ISODate } from '@almanac/core';
import { useTasks } from './tasks';
import { useInterop } from './interop';

beforeEach(() => {
  globalThis.localStorage.clear();
  useTasks.setState({ loaded: true, loading: false, items: [] });
  useInterop.setState({ from: '2026-07-01' as ISODate, to: '2026-07-31' as ISODate, lastImport: null });
});

const SAMPLE = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:trip@x',
  'SUMMARY:Conference',
  'LOCATION:Berlin',
  'DTSTART:20260706T090000Z',
  'DTEND:20260706T170000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('ICS import/export wiring (P8)', () => {
  it('imports events into the tasks store as events', async () => {
    await useInterop.getState().importText(SAMPLE);
    expect(useInterop.getState().lastImport).toEqual({ imported: 1, skipped: 0 });
    const items = useTasks.getState().items;
    expect(items).toHaveLength(1);
    const event = items[0];
    expect(event?.kind).toBe('event');
    expect(event?.title).toBe('Conference');
    expect(event?.kind === 'event' && event.place).toBe('Berlin');
  });

  it('round-trips: imported events export back to ICS in the chosen range', async () => {
    await useInterop.getState().importText(SAMPLE);
    const ics = useInterop.getState().exportText();
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Conference');
    expect(ics).toContain('LOCATION:Berlin');
  });

  it('excludes events outside the export range', async () => {
    await useInterop.getState().importText(SAMPLE);
    useInterop.setState({ from: '2026-08-01' as ISODate, to: '2026-08-31' as ISODate });
    const ics = useInterop.getState().exportText();
    expect(ics).not.toContain('Conference');
  });

  it('never throws on a garbage file — imports nothing, skips nothing', async () => {
    await useInterop.getState().importText('total garbage');
    expect(useInterop.getState().lastImport).toEqual({ imported: 0, skipped: 0 });
    expect(useTasks.getState().items).toHaveLength(0);
  });
});
