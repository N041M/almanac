import type { ISODate } from '@almanac/core';

/**
 * The engine's data model, exactly §6.1. A meal's *food* attributes live in
 * the food kernel as a `Recipe`; these are its *planning* attributes, linked
 * by `recipeId` — the engine reads tags from the linked recipe.
 */
export interface PlanItem {
  recipeId: string;
  /** Frequency multiplier; presets 0.4 / 1 / 2 / 3.5 (`WEIGHT_PRESETS`). */
  weight: number;
  /** null ⇒ use `Settings.defaultCooldown`. */
  cooldownDays: number | null;
  enabled: boolean;
  /** Committed history only — the visible plan is never folded back in (§6.5). */
  lastServed: ISODate | null;
}

export interface Settings {
  /** Days. */
  defaultCooldown: number;
  /** 0..1 slider — the sampling temperature (§6.4). */
  variety: number;
  noWeekRepeat: boolean;
  avoidSameTag: boolean;
  /** Locale-driven week start (the plan's first day). */
  weekStart: ISODate;
}

/** The "why this pick" panel's data (§6.6) — recorded at draw time. */
export interface SelectionBreakdown {
  prob: number;
  candidateCount: number;
  fFreq: number;
  fRec: number;
  fTag: number;
  /** null ⇒ never served. */
  daysSince: number | null;
  alternatives: { id: string; name: string; p: number }[];
}

export interface PlanEntry {
  /** Weekday key ("monday" … "sunday") — views translate it (L7). */
  dayName: string;
  date: ISODate;
  /** null = an empty slot (the ladder's last rung, §6.5) — a normal state. */
  recipeId: string | null;
  locked: boolean;
  breakdown: SelectionBreakdown | null;
}

/** Length 7, `Settings.weekStart` .. +6. */
export type WeekPlan = PlanEntry[];
