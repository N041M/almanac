import type { Clock, ISODate } from '@almanac/core';

// The app layer is the sanctioned edge for real time (the core only ever sees
// an injected Clock, L4).
export const systemClock: Clock = { now: () => Date.now() };

// The user's "today" is their *local* calendar date, so it comes from local
// Date components, not UTC.
export function today(): ISODate {
  const d = new Date();
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
