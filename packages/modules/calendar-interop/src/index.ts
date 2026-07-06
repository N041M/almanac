// @almanac/calendar-interop — RFC 5545 (ICS) import/export as a pure transform
// (roadmap P8). Depends on @almanac/core only (L1): it reads ICS into, and
// writes ICS out of, a neutral CalendarEvent DTO built on core's Recurrence +
// TimedSpan. It knows nothing of the tasks module — the app maps the DTO onto
// the event shape and back. Own minimal parser (P8 entry decision): the subset
// we need maps directly onto core types, no external dependency (L3).

export type { CalendarEvent, IcsWhen, ImportResult } from './types.js';
export { parseIcs } from './parse-ics.js';
export { serializeIcs } from './serialize-ics.js';
export { parseRrule, formatRrule } from './rrule.js';
export { interopManifest } from './manifest.js';

export const INTEROP_MODULE_VERSION = '0.0.0';
