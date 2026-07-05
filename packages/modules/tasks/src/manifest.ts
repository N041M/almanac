import type { ModuleManifest } from '@almanac/core';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The tasks module's manifest. No day-slice codecs: items are entity records
 * (D6 tombstones) queried by range via `occurrencesForRange` — the app wires
 * that at the shell, same as every module capability (L1).
 */
export const tasksManifest: ModuleManifest = {
  id: 'tasks',
  messages: { en, cs },
};
