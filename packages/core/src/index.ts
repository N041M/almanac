// @almanac/core — the pure, zero-dependency hub. Knows about no module (L1/L3).
// Public API: ports (seams), time, rng, units, schedule/recurrence, the day
// record + store, the calendar model, the signal registry, and i18n.
export * from './ports/index.js';
export * from './time/index.js';
export * from './rng/index.js';
export * from './units/index.js';
export * from './schedule/index.js';
export * from './day/index.js';
export * from './calendar/index.js';
export * from './registry/index.js';
export * from './i18n/index.js';
export * from './module/index.js';

export const CORE_VERSION = '0.0.0';
