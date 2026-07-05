import type { Rng } from '@almanac/core';

// §6.2 — exported, never inlined. Tuning happens here, nowhere else.

/** Days; recovery rate after a meal appears (recency e-folding time). */
export const RECENCY_TAU = 5.5;

/** Multiplier when the candidate shares a tag with the previous day's meal. */
export const TAG_PENALTY = 0.35;

/** Weight presets: rare / normal / often / favourite (§6.2). */
export const WEIGHT_PRESETS = {
  rare: 0.4,
  normal: 1,
  often: 2,
  favourite: 3.5,
} as const;

/** Score floor — keeps every candidate drawable (never a hard zero). */
export const MIN_SCORE = 1e-6;

/** temperature = TEMPERATURE_BASE + variety * TEMPERATURE_VARIETY_SPAN (§6.4). */
export const TEMPERATURE_BASE = 0.45;
export const TEMPERATURE_VARIETY_SPAN = 2.2;

/** How many runner-ups the breakdown shows next to the chosen meal (§6.6). */
export const ALTERNATIVES_SHOWN = 3;

/**
 * The sampling temperature (§6.4): variety 0 sharpens toward
 * least-recently-used rotation; variety 1 flattens toward surprise.
 */
export function temperature(variety: number): number {
  return TEMPERATURE_BASE + variety * TEMPERATURE_VARIETY_SPAN;
}

/** JITTER (§6.2): a ±10% per-candidate nudge so ties don't resolve identically. */
export function jitter(rng: Rng): number {
  return 0.9 + 0.2 * rng();
}
