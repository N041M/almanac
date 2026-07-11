import type { ModuleManifest, SliceCodec } from '@almanac/core';
import { BODY_NAMESPACE, bodyDayCodec } from './slice.js';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The body module's manifest: its day-slice codec (weight + composition) and
 * its i18n namespace. The trend derives on read — the slice is the only
 * stored truth (§8).
 */
export const bodyManifest: ModuleManifest = {
  id: BODY_NAMESPACE,
  codecs: [bodyDayCodec as SliceCodec<unknown>],
  messages: { en, cs },
};
