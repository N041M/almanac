import type { SliceCodec } from '@almanac/core';
import type { SelectionBreakdown } from './engine/types.js';

/**
 * The meals module's contribution to a Day (§5: `meals.recipeId`) — one
 * planned meal per date. The day-store guarantees a corrupt or unknown-version
 * payload degrades to the default without touching other slices (L5).
 */
export interface MealsDaySlice {
  recipeId: string | null;
  locked: boolean;
  breakdown: SelectionBreakdown | null;
}

export const MEALS_NAMESPACE = 'meals';
export const MEALS_SLICE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFinite_(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function decodeBreakdown(value: unknown): SelectionBreakdown | null {
  if (!isRecord(value)) return null;
  const { prob, candidateCount, fFreq, fRec, fTag, daysSince, alternatives } = value;
  if (!isFinite_(prob) || !isFinite_(candidateCount)) return null;
  if (!isFinite_(fFreq) || !isFinite_(fRec) || !isFinite_(fTag)) return null;
  if (daysSince !== null && !isFinite_(daysSince)) return null;
  if (!Array.isArray(alternatives)) return null;
  const alts: SelectionBreakdown['alternatives'] = [];
  for (const alt of alternatives) {
    if (!isRecord(alt)) return null;
    if (typeof alt['id'] !== 'string' || typeof alt['name'] !== 'string' || !isFinite_(alt['p'])) {
      return null;
    }
    alts.push({ id: alt['id'], name: alt['name'], p: alt['p'] });
  }
  return { prob, candidateCount, fFreq, fRec, fTag, daysSince, alternatives: alts };
}

export const mealsDayCodec: SliceCodec<MealsDaySlice> = {
  namespace: MEALS_NAMESPACE,
  version: MEALS_SLICE_VERSION,
  default: () => ({ recipeId: null, locked: false, breakdown: null }),
  decode: (raw) => {
    if (!isRecord(raw)) throw new Error('meals slice: not an object');
    const recipeId = raw['recipeId'];
    if (recipeId !== null && typeof recipeId !== 'string') {
      throw new Error('meals slice: bad recipeId');
    }
    return {
      recipeId,
      locked: raw['locked'] === true,
      // A malformed breakdown costs only itself — the planned meal stands (L5).
      breakdown: decodeBreakdown(raw['breakdown']),
    };
  },
  encode: (value) => value,
};
