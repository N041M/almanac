import type { Clock, StoragePort } from '@almanac/core';
import { isValidCalendarDay, type Birthday } from './birthdays.js';

// The module's only state: the entry list under one key, a versioned envelope
// like every slice (§11). Reads never throw; a malformed entry costs only
// itself (L5).

const ENTRIES_KEY = 'birthdays:entries';
export const BIRTHDAYS_VERSION = 1;

interface Envelope {
  v: number;
  d: unknown;
  m?: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function decodeEntry(value: unknown): Birthday | null {
  if (!isRecord(value) || typeof value['id'] !== 'string') return null;
  const name = typeof value['name'] === 'string' ? value['name'].trim() : '';
  const month = value['month'];
  const day = value['day'];
  if (name === '' || typeof month !== 'number' || typeof day !== 'number') return null;
  if (!isValidCalendarDay(month, day)) return null;
  const year = value['year'];
  return {
    id: value['id'],
    name,
    month,
    day,
    year: typeof year === 'number' && Number.isInteger(year) && year > 0 ? year : null,
  };
}

export interface BirthdaysStore {
  getEntries(): Promise<Birthday[]>;
  saveEntries(entries: ReadonlyArray<Birthday>): Promise<void>;
}

export function createBirthdaysStore(storage: StoragePort, clock?: Clock): BirthdaysStore {
  return {
    getEntries: async () => {
      let raw: string | null;
      try {
        raw = await storage.read(ENTRIES_KEY);
      } catch {
        return [];
      }
      if (raw === null) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isEnvelope(parsed) || parsed.v !== BIRTHDAYS_VERSION) return [];
        const list = parsed.d;
        if (!Array.isArray(list)) return [];
        return list.map(decodeEntry).filter((entry): entry is Birthday => entry !== null);
      } catch {
        return [];
      }
    },
    saveEntries: async (entries) => {
      const envelope: Envelope = {
        v: BIRTHDAYS_VERSION,
        d: entries,
        ...(clock !== undefined ? { m: clock.now() } : {}),
      };
      await storage.write(ENTRIES_KEY, JSON.stringify(envelope));
    },
  };
}
