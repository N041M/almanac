import { createCheckinStore } from '@almanac/checkin';
import { dayStore } from './persistence';

// Composition root for the check-in module. Its only state is the day slice,
// riding the shared day store other modules (cycle, insights) read too (§8).
export const checkinStore = createCheckinStore(dayStore);
