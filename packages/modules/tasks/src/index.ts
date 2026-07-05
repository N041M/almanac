// @almanac/tasks — tasks · events · habits (§8), the calendar-completeness
// module built on the v2 primitives (5.1 recurrence/overrides, 5.2 timed
// spans). Depends on @almanac/core only — never another module (L1). The
// first persister of real events: D6 tombstones + D7 shape from day one.

export type {
  TaskItem,
  Task,
  EventItem,
  EventPatch,
  EventWhen,
  Habit,
  DueDate,
} from './types.js';
export { TASKS_SCHEMA_VERSION, decodeTaskItem } from './codec.js';
export type { TasksStore } from './tasks-store.js';
export { createTasksStore } from './tasks-store.js';
export type { DayOccurrence } from './occurrences.js';
export { occurrencesForRange, habitStreak } from './occurrences.js';
export type { QuickEntry } from './quick-entry.js';
export { parseQuickEntry } from './quick-entry.js';
export { tasksManifest } from './manifest.js';

export const TASKS_MODULE_VERSION = '0.0.0';
