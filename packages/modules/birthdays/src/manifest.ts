import type { ModuleManifest } from '@almanac/core';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The birthdays module's manifest. No day-slice codecs: entries are one small
 * module-key list; occurrences derive per date on read (§8).
 */
export const birthdaysManifest: ModuleManifest = {
  id: 'birthdays',
  messages: { en, cs },
};
