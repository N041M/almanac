import type { ModuleManifest } from '@almanac/core';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The calendar-interop manifest. No storage slice: this module is a pure
 * transform (ICS ↔ CalendarEvent). Imported events land in the tasks module via
 * the app shell, which composes across modules (L1 binds modules, not the app).
 */
export const interopManifest: ModuleManifest = {
  id: 'interop',
  messages: { en, cs },
};
