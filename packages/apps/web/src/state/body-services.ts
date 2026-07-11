import { createBodyStore } from '@almanac/body';
import { dayStore } from './persistence';

// Composition root for the body module. The day slice is its only state; the
// trend derives on read. A smart-scale import would arrive behind a
// capability port later (§8) — the store shape wouldn't change.
export const bodyStore = createBodyStore(dayStore);
