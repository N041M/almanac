import { useSettings } from './settings';

/**
 * The modules a user can hide from settings. Hiding is a view filter over the
 * nav and the calendar's contributions — the module's data and slices stay
 * untouched underneath, exactly the "module absent" degradation row (L5).
 */
export const TOGGLEABLE_MODULES = [
  'tasks',
  'meals',
  'shopping',
  'macros',
  'checkin',
  'cycle',
  'body',
  'workouts',
] as const;
export type ToggleableModuleId = (typeof TOGGLEABLE_MODULES)[number];

/** True unless the user hid the module in settings. */
export function useModuleVisible(id: ToggleableModuleId): boolean {
  return useSettings((s) => !s.hiddenModules.includes(id));
}
