import { createDayStore } from '@almanac/core';
import { createStoragePort } from '../storage/create-storage-port';
import { systemClock } from '../clock';

// The app's one storage port (SQLite in the Tauri shell, localStorage in the
// web port) and the one day-store over it, shared by every feature store. The
// clock stamps writes with modified-at so slice data is sync-ready (D4).
export const storagePort = createStoragePort();
export const dayStore = createDayStore(storagePort, systemClock);
