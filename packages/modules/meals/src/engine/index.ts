export type {
  PlanItem,
  Settings,
  SelectionBreakdown,
  PlanEntry,
  WeekPlan,
} from './types.js';
export {
  RECENCY_TAU,
  TAG_PENALTY,
  WEIGHT_PRESETS,
  MIN_SCORE,
  TEMPERATURE_BASE,
  TEMPERATURE_VARIETY_SPAN,
  ALTERNATIVES_SHOWN,
  temperature,
  jitter,
} from './constants.js';
export type { GateFlags } from './gates.js';
export { ALL_GATES, daysSince, passesGates } from './gates.js';
export { recencyFactor, tagFactor } from './scorers.js';
export type { Candidate } from './candidates.js';
export { buildCandidates } from './candidates.js';
export type { DrawResult } from './draw.js';
export { draw } from './draw.js';
export type { SlotSelection } from './select-slot.js';
export { selectSlot } from './select-slot.js';
export { generateWeek, dayNameOf } from './generate-week.js';
export { rerollDay } from './reroll-day.js';
export type { CommitResult } from './commit-week.js';
export { commitWeek } from './commit-week.js';
