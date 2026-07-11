import type { SliceCodec } from '@almanac/core';

/**
 * The check-in module's contribution to a Day (§8): one quick log — mood,
 * energy, symptoms, a note. Every field is optional and sparse: a null rating
 * or empty list is the ordinary "not logged" state, never an error (L5).
 * Cycle and insights read this as shared day data by namespace, never by
 * import (L1).
 */
export interface CheckinDaySlice {
  /** 1–5, null = not logged. */
  mood: number | null;
  /** 1–5, null = not logged. */
  energy: number | null;
  symptoms: string[];
  note: string;
}

export const CHECKIN_NAMESPACE = 'checkin';
export const CHECKIN_SLICE_VERSION = 1;

/** The shared 1–5 scale both ratings use. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** True when the day has any logged content — the "render nothing" test (L5). */
export function hasCheckin(slice: CheckinDaySlice | undefined): boolean {
  if (slice === undefined) return false;
  return (
    slice.mood !== null || slice.energy !== null || slice.symptoms.length > 0 || slice.note !== ''
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** An out-of-scale or non-integer rating reads as "not logged", not an error (L5). */
function decodeRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= RATING_MIN && value <= RATING_MAX ? value : null;
}

export const checkinDayCodec: SliceCodec<CheckinDaySlice> = {
  namespace: CHECKIN_NAMESPACE,
  version: CHECKIN_SLICE_VERSION,
  default: () => ({ mood: null, energy: null, symptoms: [], note: '' }),
  decode: (raw) => {
    if (!isRecord(raw)) throw new Error('checkin slice: not an object');
    // A malformed symptom costs only itself — the rest of the log stands (L5).
    const symptoms = Array.isArray(raw['symptoms'])
      ? raw['symptoms'].filter((s): s is string => typeof s === 'string' && s.trim() !== '')
      : [];
    return {
      mood: decodeRating(raw['mood']),
      energy: decodeRating(raw['energy']),
      symptoms,
      note: typeof raw['note'] === 'string' ? raw['note'] : '',
    };
  },
  encode: (value) => value,
};
