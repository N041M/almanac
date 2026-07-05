// Ports — the seams that keep the core pure (L3), deterministic (L4), and
// local-first (L6). One file per port (concern separation). Adapters live in
// kernels/apps; the core only defines these contracts.
export type { Clock } from './clock.js';
export type { Rng } from './rng.js';
export type { StoragePort } from './storage.js';
export type { GeoCoordinates, WeatherSnapshot, WeatherPort } from './weather.js';
export type { NutritionResult, NutritionPort } from './nutrition.js';
export type { NotificationPayload, NotificationPort } from './notification.js';
export type { SyncRecord, SyncPullResult, SyncPort } from './sync.js';
