import type { ISODate, Rng } from '@almanac/core';
import type { Recipe } from '@almanac/food';
import type { PlanItem, Settings } from './types.js';
import type { GateFlags } from './gates.js';
import { daysSince, passesGates } from './gates.js';
import { recencyFactor, tagFactor } from './scorers.js';
import { MIN_SCORE, jitter, temperature } from './constants.js';

/** One gated, scored contender for a slot — carries its factors for the breakdown. */
export interface Candidate {
  id: string;
  name: string;
  fFreq: number;
  fRec: number;
  fTag: number;
  /** null ⇒ never served/placed. */
  daysSince: number | null;
  /** score^(1/temperature) * jitter — what the roulette wheel actually uses. */
  samplingWeight: number;
}

/**
 * Gates → scorers (§6.3/§6.4) for one slot. A missing linked recipe degrades,
 * not gates: the meal stays plannable with no tags and its id as name (L5).
 * Consumes one `rng()` per candidate (the jitter) — deterministic per seed.
 */
export function buildCandidates(
  items: ReadonlyArray<PlanItem>,
  recipes: ReadonlyMap<string, Recipe>,
  slotDate: ISODate,
  working: ReadonlyMap<string, ISODate>,
  usedThisWeek: ReadonlySet<string>,
  previousDayTags: ReadonlySet<string>,
  settings: Settings,
  rng: Rng,
  flags: GateFlags,
): Candidate[] {
  const exponent = 1 / temperature(settings.variety);
  const candidates: Candidate[] = [];

  for (const item of items) {
    if (!passesGates(item, slotDate, working, usedThisWeek, settings, flags)) continue;

    const recipe = recipes.get(item.recipeId);
    const d = daysSince(item, slotDate, working);
    const fFreq = item.weight;
    const fRec = recencyFactor(d ?? Infinity);
    const fTag = tagFactor(recipe?.tags ?? [], previousDayTags, settings.avoidSameTag);
    const score = Math.max(fFreq * fRec * fTag, MIN_SCORE);

    candidates.push({
      id: item.recipeId,
      name: recipe?.name ?? item.recipeId,
      fFreq,
      fRec,
      fTag,
      daysSince: d,
      samplingWeight: score ** exponent * jitter(rng),
    });
  }

  return candidates;
}
