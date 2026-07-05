import type { Rng } from '@almanac/core';
import type { Candidate } from './candidates.js';

export interface DrawResult {
  pick: Candidate;
  /** The full probability distribution the pick was drawn from (§6.5). */
  distribution: { id: string; name: string; p: number }[];
}

/**
 * Weighted random pick — roulette, proportional to `samplingWeight`, **never
 * argmax** (§6.6: greedy is the failure mode; identical state must still yield
 * different weeks). `excludeId` drops the current pick on re-roll unless it's
 * the only option. Empty candidates ⇒ null (the ladder handles it, §6.5).
 */
export function draw(
  candidates: ReadonlyArray<Candidate>,
  rng: Rng,
  excludeId?: string,
): DrawResult | null {
  const withoutExcluded = candidates.filter((c) => c.id !== excludeId);
  const pool = withoutExcluded.length > 0 ? withoutExcluded : candidates;
  if (pool.length === 0) return null;

  const total = pool.reduce((sum, c) => sum + c.samplingWeight, 0);
  const distribution = pool.map((c) => ({
    id: c.id,
    name: c.name,
    p: total > 0 ? c.samplingWeight / total : 1 / pool.length,
  }));

  // Roulette walk; degenerate all-zero weights fall back to a uniform pick.
  let pick = pool[pool.length - 1] as Candidate;
  if (total > 0) {
    let threshold = rng() * total;
    for (const candidate of pool) {
      threshold -= candidate.samplingWeight;
      if (threshold < 0) {
        pick = candidate;
        break;
      }
    }
  } else {
    pick = pool[Math.min(Math.floor(rng() * pool.length), pool.length - 1)] as Candidate;
  }

  return { pick, distribution };
}
