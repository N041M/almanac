import type { ISODate, Rng } from '@almanac/core';
import type { Recipe } from '@almanac/food';
import type { PlanItem, SelectionBreakdown, Settings } from './types.js';
import type { GateFlags } from './gates.js';
import { buildCandidates } from './candidates.js';
import { draw } from './draw.js';
import { ALTERNATIVES_SHOWN } from './constants.js';

/**
 * The degradation ladder's rungs (§6.5), in relaxation order: all gates → drop
 * week-repeat → drop cooldown. `enabled` is on every rung. Running out of
 * rungs leaves the slot null — a normal state, never a throw.
 */
const LADDER: ReadonlyArray<GateFlags> = [
  { cooldown: true, weekRepeat: true },
  { cooldown: true, weekRepeat: false },
  { cooldown: false, weekRepeat: false },
];

export interface SlotSelection {
  recipeId: string;
  breakdown: SelectionBreakdown;
}

/** One slot: gates → scorers → draw, relaxing down the ladder (§6.5). */
export function selectSlot(
  items: ReadonlyArray<PlanItem>,
  recipes: ReadonlyMap<string, Recipe>,
  slotDate: ISODate,
  working: ReadonlyMap<string, ISODate>,
  usedThisWeek: ReadonlySet<string>,
  previousDayTags: ReadonlySet<string>,
  settings: Settings,
  rng: Rng,
  excludeId?: string,
): SlotSelection | null {
  for (const flags of LADDER) {
    const candidates = buildCandidates(
      items,
      recipes,
      slotDate,
      working,
      usedThisWeek,
      previousDayTags,
      settings,
      rng,
      flags,
    );
    const result = draw(candidates, rng, excludeId);
    if (result === null) continue;

    const { pick, distribution } = result;
    const prob = distribution.find((d) => d.id === pick.id)?.p ?? 0;
    const alternatives = distribution
      .filter((d) => d.id !== pick.id)
      .sort((a, b) => b.p - a.p)
      .slice(0, ALTERNATIVES_SHOWN);

    return {
      recipeId: pick.id,
      breakdown: {
        prob,
        candidateCount: distribution.length,
        fFreq: pick.fFreq,
        fRec: pick.fRec,
        fTag: pick.fTag,
        daysSince: pick.daysSince,
        alternatives,
      },
    };
  }
  return null;
}
