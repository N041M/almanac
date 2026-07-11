import type { SliceCodec } from '@almanac/core';

/**
 * The body module's contribution to a Day (§8): user-entered weight and
 * (optional) body composition. Composition is an input the user types, never
 * something the app measures; it mainly feeds macro targets later. Weight is
 * stored canonically in kg (the units kernel converts for display). Every
 * field absent is the ordinary "not logged" state (L5).
 */
export interface BodyDaySlice {
  weightKg: number | null;
  bodyFatPct: number | null;
}

export const BODY_NAMESPACE = 'body';
export const BODY_SLICE_VERSION = 1;

// Values outside these are typos, not bodies — they read as not-logged (L5).
export const MIN_PLAUSIBLE_WEIGHT_KG = 20;
export const MAX_PLAUSIBLE_WEIGHT_KG = 400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function decodeWeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= MIN_PLAUSIBLE_WEIGHT_KG && value <= MAX_PLAUSIBLE_WEIGHT_KG ? value : null;
}

function decodeBodyFat(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value > 0 && value < 100 ? value : null;
}

export const bodyDayCodec: SliceCodec<BodyDaySlice> = {
  namespace: BODY_NAMESPACE,
  version: BODY_SLICE_VERSION,
  default: () => ({ weightKg: null, bodyFatPct: null }),
  decode: (raw) => {
    if (!isRecord(raw)) throw new Error('body slice: not an object');
    return {
      weightKg: decodeWeight(raw['weightKg']),
      bodyFatPct: decodeBodyFat(raw['bodyFatPct']),
    };
  },
  encode: (value) => value,
};
