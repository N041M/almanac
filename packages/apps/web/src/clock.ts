import type { Clock, ISODate } from '@almanac/core';

// The app layer may read the real clock; the core stays deterministic and only
// ever sees this injected (L4). `todayISO` in the core is UTC by design; the
// user's "today", however, is their *local* calendar date — so the app derives
// it here from local Date components.
export const systemClock: Clock = { now: () => Date.now() };

export function today(): ISODate {
  const d = new Date();
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
