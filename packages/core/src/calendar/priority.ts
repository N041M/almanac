/**
 * The single intensity scale the calendar owns (design §5), so priority reads
 * consistently across every module.
 *
 * **Numbered priority (D9):** a priority is any positive integer — 1 is the most
 * important, and there is no upper bound (three levels weren't enough). The
 * original §5 presets keep their exact values (P1 solid, P2 ~30% faded, P3 ~60%
 * faded); beyond that the fade continues by the same step but is **capped**, so
 * a very low priority is still legible and never fades to nothing. Absent
 * priority → full intensity (L5).
 */
export type Priority = number;

/** Fade applied per step below P1. */
export const PRIORITY_FADE_STEP = 0.3;
/** The floor the fade never goes below — low priority stays readable. */
export const MIN_PRIORITY_INTENSITY = 0.4;

export function intensityForPriority(priority: Priority | undefined): number {
  // Absent, malformed, or P1 (and anything "above" it) reads at full intensity.
  if (priority === undefined || !Number.isFinite(priority) || priority <= 1) return 1;
  const faded = 1 - (Math.floor(priority) - 1) * PRIORITY_FADE_STEP;
  return Math.max(MIN_PRIORITY_INTENSITY, faded);
}

/** A usable priority: a positive integer, or `undefined` when it isn't one. */
export function normalizePriority(value: unknown): Priority | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const n = Math.floor(value);
  return n >= 1 ? n : undefined;
}
