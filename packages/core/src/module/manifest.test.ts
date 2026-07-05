import { describe, expect, it } from 'vitest';
import { applyManifests } from './manifest.js';
import { createSignalRegistry } from '../registry/registry.js';
import type { SliceCodec } from '../day/slice-codec.js';

const codec: SliceCodec<unknown> = {
  namespace: 'meals',
  version: 1,
  default: () => null,
  decode: (raw) => raw,
  encode: (value) => value,
};

describe('applyManifests', () => {
  it('folds messages into per-namespace bundles and collects codecs', () => {
    const { bundles, codecs } = applyManifests([
      { id: 'meals', codecs: [codec], messages: { en: { title: 'Meals' }, cs: { title: 'Jídla' } } },
      { id: 'tasks', messages: { en: { title: 'Tasks' } } },
    ]);
    expect(bundles['en']).toEqual({ meals: { title: 'Meals' }, tasks: { title: 'Tasks' } });
    expect(bundles['cs']).toEqual({ meals: { title: 'Jídla' } });
    expect(codecs).toEqual([codec]);
  });

  it('registers declared signals', () => {
    const registry = createSignalRegistry();
    applyManifests([{ id: 'weather', signals: { 'weather.tempC': () => 21 } }], registry);
    expect(registry.get<number>('weather.tempC')).toBe(21);
  });

  it('a bare-id manifest is valid; absent capabilities are simply absent (L5)', () => {
    const { bundles, codecs } = applyManifests([{ id: 'stub' }]);
    expect(bundles).toEqual({});
    expect(codecs).toEqual([]);
  });
});
