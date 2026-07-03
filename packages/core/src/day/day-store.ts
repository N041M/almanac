import type { ISODate } from '../time/iso-date.js';
import type { StoragePort } from '../ports/storage.js';
import type { Clock } from '../ports/clock.js';
import type { SliceCodec } from './slice-codec.js';
import type { Day } from './day.js';
import { emptyDay, withSlice } from './day.js';
import { addDays, diffDays } from '../time/date-math.js';

/**
 * Reads/writes Days as isolated, versioned per-module slices (design §5/§11).
 * The load-bearing L5 guarantee: `readSlice` **never throws** — a missing,
 * corrupt, or unknown-version payload degrades to the module's default, and one
 * bad slice never takes down another slice, the Day, or the app.
 */
export interface DayStore {
  readSlice<T>(date: ISODate, codec: SliceCodec<T>): Promise<T>;
  writeSlice<T>(date: ISODate, codec: SliceCodec<T>, value: T): Promise<void>;
  /** Assemble a Day from the given module codecs (each slice read in isolation). */
  getDay(date: ISODate, codecs: ReadonlyArray<SliceCodec<unknown>>): Promise<Day>;
  getRange(
    start: ISODate,
    end: ISODate,
    codecs: ReadonlyArray<SliceCodec<unknown>>,
  ): Promise<Day[]>;
}

function sliceKey(date: ISODate, namespace: string): string {
  return `day:${date}:${namespace}`;
}

interface Envelope {
  v: number;
  d: unknown;
  /** Modified-at (epoch ms) — lets sync do last-writer-wins per slice (D4). */
  m?: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

/** Envelope → slice value; anything unexpected degrades to the default (L5). */
function decodeRaw<T>(raw: string | null, codec: SliceCodec<T>): T {
  if (raw === null) return codec.default();
  try {
    const parsed: unknown = JSON.parse(raw);
    // Unknown/other version → default (isolation; migrations come later, §11).
    if (!isEnvelope(parsed) || parsed.v !== codec.version) return codec.default();
    return codec.decode(parsed.d);
  } catch {
    return codec.default();
  }
}

/**
 * `clock` stamps each write's envelope with a modified-at, keeping slice data
 * sync-ready (D4). Omitted (e.g. in pure logic tests), writes simply carry no
 * timestamp — reads are unaffected.
 */
export function createDayStore(storage: StoragePort, clock?: Clock): DayStore {
  async function readSlice<T>(date: ISODate, codec: SliceCodec<T>): Promise<T> {
    let raw: string | null;
    try {
      raw = await storage.read(sliceKey(date, codec.namespace));
    } catch {
      return codec.default(); // storage read failure → default (L5)
    }
    return decodeRaw(raw, codec);
  }

  async function writeSlice<T>(
    date: ISODate,
    codec: SliceCodec<T>,
    value: T,
  ): Promise<void> {
    const envelope: Envelope = {
      v: codec.version,
      d: codec.encode(value),
      ...(clock !== undefined ? { m: clock.now() } : {}),
    };
    await storage.write(sliceKey(date, codec.namespace), JSON.stringify(envelope));
  }

  async function getDay(
    date: ISODate,
    codecs: ReadonlyArray<SliceCodec<unknown>>,
  ): Promise<Day> {
    let day = emptyDay(date);
    for (const codec of codecs) {
      day = withSlice(day, codec.namespace, await readSlice(date, codec));
    }
    return day;
  }

  async function getRange(
    start: ISODate,
    end: ISODate,
    codecs: ReadonlyArray<SliceCodec<unknown>>,
  ): Promise<Day[]> {
    const span = diffDays(start, end);
    if (span < 0) return [];
    const dates: ISODate[] = [];
    for (let i = 0; i <= span; i++) dates.push(addDays(start, i));

    // Without a batch read, fall back to per-slice reads (L5).
    if (storage.readMany === undefined) {
      const days: Day[] = [];
      for (const date of dates) days.push(await getDay(date, codecs));
      return days;
    }

    const keys = dates.flatMap((date) =>
      codecs.map((codec) => sliceKey(date, codec.namespace)),
    );
    let raws: (string | null)[];
    try {
      raws = await storage.readMany(keys);
    } catch {
      raws = keys.map(() => null); // batch failure → every slice defaults (L5)
    }
    return dates.map((date, di) => {
      let day = emptyDay(date);
      codecs.forEach((codec, ci) => {
        day = withSlice(
          day,
          codec.namespace,
          decodeRaw(raws[di * codecs.length + ci] ?? null, codec),
        );
      });
      return day;
    });
  }

  return { readSlice, writeSlice, getDay, getRange };
}
