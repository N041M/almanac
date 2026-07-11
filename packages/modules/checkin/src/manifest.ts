import type { ModuleManifest, SliceCodec } from '@almanac/core';
import { CHECKIN_NAMESPACE, checkinDayCodec } from './slice.js';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The check-in module's manifest: its day-slice codec (the quick log the day
 * record carries) and its i18n namespace. All state is per-day — no module
 * keys, no engine (§8).
 */
export const checkinManifest: ModuleManifest = {
  id: CHECKIN_NAMESPACE,
  codecs: [checkinDayCodec as SliceCodec<unknown>],
  messages: { en, cs },
};
