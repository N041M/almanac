import type { SliceCodec } from '@almanac/core';

/**
 * A tiny demo slice so the shell exercises the full Day pipeline end-to-end —
 * render → persist → reload — before real modules exist. "Star a day" writes an
 * isolated, versioned slice through the DayStore; a corrupt payload would
 * degrade to `{ starred: false }` (L5) without touching any other slice.
 */
export interface DayMark {
  starred: boolean;
}

export const DAY_MARK_NAMESPACE = 'demo';

export const dayMarkCodec: SliceCodec<DayMark> = {
  namespace: DAY_MARK_NAMESPACE,
  version: 1,
  default: () => ({ starred: false }),
  decode: (raw) => {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      typeof (raw as DayMark).starred !== 'boolean'
    ) {
      throw new Error('invalid day mark');
    }
    return raw as DayMark;
  },
  encode: (value) => value,
};
