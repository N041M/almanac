import { createBirthdaysStore } from '@almanac/birthdays';
import { storagePort } from './persistence';
import { systemClock } from '../clock';

// Composition root for the birthdays module. Entries under one module key;
// occurrences derive per date on read. Contacts import arrives later behind
// a capability port — manual entries are the full core behaviour (§8).
export const birthdaysStore = createBirthdaysStore(storagePort, systemClock);
