import { RECENCY_TAU, TAG_PENALTY } from './constants.js';

// §6.4 — soft, multiplicative scorers: they shape probability, not eligibility.

/**
 * recencyFactor(d) = 1 - exp(-|d| / RECENCY_TAU); never-served (Infinity) ⇒ 1.
 * Soft by design: recent meals become *unlikely*, not forbidden (§6.6).
 */
export function recencyFactor(daysSince: number): number {
  if (daysSince === Infinity) return 1;
  return 1 - Math.exp(-Math.abs(daysSince) / RECENCY_TAU);
}

/** TAG_PENALTY when the candidate shares a tag with yesterday's meal, else 1. */
export function tagFactor(
  tags: ReadonlyArray<string>,
  previousDayTags: ReadonlySet<string>,
  avoidSameTag: boolean,
): number {
  if (!avoidSameTag) return 1;
  return tags.some((tag) => previousDayTags.has(tag)) ? TAG_PENALTY : 1;
}
