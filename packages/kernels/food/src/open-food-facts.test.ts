import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@almanac/core';
import { OFF_BASE_URL, createOpenFoodFactsPort } from './open-food-facts.js';
import type { FetchJson } from './open-food-facts.js';

const PRODUCT_PAYLOAD = {
  status: 1,
  product: {
    code: '123',
    product_name: 'Rye bread',
    nutriments: {
      'energy-kcal_100g': 250,
      proteins_100g: 8,
      carbohydrates_100g: 48,
      fat_100g: 1.5,
      sodium_100g: 0.4, // extra fields are ignored
    },
  },
};

function port(fetchJson: FetchJson, cache = createMemoryStorage()) {
  return {
    port: createOpenFoodFactsPort({ fetchJson, userAgent: 'Almanac/0.0 (test)', cache }),
    cache,
  };
}

describe('createOpenFoodFactsPort — byBarcode', () => {
  it('maps a v2 product payload to a NutritionResult', async () => {
    const fetchJson = vi.fn<FetchJson>().mockResolvedValue(PRODUCT_PAYLOAD);
    const { port: off } = port(fetchJson);
    expect(await off.byBarcode('123')).toEqual({
      name: 'Rye bread',
      barcode: '123',
      per100g: { kcal: 250, proteinG: 8, carbsG: 48, fatG: 1.5 },
    });
    const [url, headers] = fetchJson.mock.calls[0] ?? [];
    expect(url).toContain(`${OFF_BASE_URL}/api/v2/product/123`);
    expect(headers?.['User-Agent']).toBe('Almanac/0.0 (test)');
  });

  it('tolerates missing crowd-sourced fields (§7): no nutriments, no name', async () => {
    const fetchJson = vi.fn<FetchJson>().mockResolvedValue({
      status: 1,
      product: { code: '456' }, // nameless, factless
    });
    const { port: off } = port(fetchJson);
    // Degrades to a usable stub named by its barcode, no per100g.
    expect(await off.byBarcode('456')).toEqual({ name: '456', barcode: '456' });
  });

  it('resolves null on: unknown product, malformed payload, fetch failure, empty barcode', async () => {
    const { port: notFound } = port(vi.fn<FetchJson>().mockResolvedValue({ status: 0 }));
    expect(await notFound.byBarcode('999')).toBeNull();

    const { port: garbage } = port(vi.fn<FetchJson>().mockResolvedValue('<html>'));
    expect(await garbage.byBarcode('999')).toBeNull();

    const { port: offline } = port(vi.fn<FetchJson>().mockRejectedValue(new Error('offline')));
    expect(await offline.byBarcode('999')).toBeNull();

    const noFetch = vi.fn<FetchJson>();
    const { port: blank } = port(noFetch);
    expect(await blank.byBarcode('   ')).toBeNull();
    expect(noFetch).not.toHaveBeenCalled();
  });

  it('caches every successful lookup — the repeat read never hits the network', async () => {
    const fetchJson = vi.fn<FetchJson>().mockResolvedValue(PRODUCT_PAYLOAD);
    const { port: off } = port(fetchJson);
    await off.byBarcode('123');
    expect(await off.byBarcode('123')).toEqual(await off.byBarcode('123'));
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('ignores a corrupt cache entry and refetches', async () => {
    const cache = createMemoryStorage({ 'food:off:product:123': '{broken' });
    const fetchJson = vi.fn<FetchJson>().mockResolvedValue(PRODUCT_PAYLOAD);
    const { port: off } = port(fetchJson, cache);
    expect((await off.byBarcode('123'))?.name).toBe('Rye bread');
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('a failing cache never blocks the lookup (L5)', async () => {
    const broken = {
      ...createMemoryStorage(),
      read: () => Promise.reject(new Error('io')),
      write: () => Promise.reject(new Error('io')),
    };
    const fetchJson = vi.fn<FetchJson>().mockResolvedValue(PRODUCT_PAYLOAD);
    const off = createOpenFoodFactsPort({
      fetchJson,
      userAgent: 'Almanac/0.0 (test)',
      cache: broken,
    });
    expect((await off.byBarcode('123'))?.name).toBe('Rye bread');
  });
});

describe('createOpenFoodFactsPort — search', () => {
  it('maps products and skips nameless hits', async () => {
    const fetchJson = vi.fn<FetchJson>().mockResolvedValue({
      products: [
        PRODUCT_PAYLOAD.product,
        { code: '777' }, // nameless search hit: useless, skipped
        { product_name: 'Sourdough', code: '888' },
      ],
    });
    const { port: off } = port(fetchJson);
    const results = await off.search('bread');
    expect(results.map((r) => r.name)).toEqual(['Rye bread', 'Sourdough']);
    expect(fetchJson.mock.calls[0]?.[0]).toContain('search_terms=bread');
  });

  it('resolves [] on failure or malformed payload; empty query skips the network', async () => {
    const { port: offline } = port(vi.fn<FetchJson>().mockRejectedValue(new Error('offline')));
    expect(await offline.search('bread')).toEqual([]);

    const { port: garbage } = port(vi.fn<FetchJson>().mockResolvedValue({ nope: 1 }));
    expect(await garbage.search('bread')).toEqual([]);

    const noFetch = vi.fn<FetchJson>();
    const { port: blank } = port(noFetch);
    expect(await blank.search('  ')).toEqual([]);
    expect(noFetch).not.toHaveBeenCalled();
  });

  it('never caches an empty result set — a later retry re-queries', async () => {
    const cache = createMemoryStorage();
    const empty = vi.fn<FetchJson>().mockResolvedValue({ products: [] });
    const { port: off } = port(empty, cache);
    expect(await off.search('obscure')).toEqual([]);
    expect(await off.search('obscure')).toEqual([]);
    expect(empty).toHaveBeenCalledTimes(2); // no empty answer was cached

    // Data appeared upstream: the same query now succeeds and caches.
    const found = vi.fn<FetchJson>().mockResolvedValue({ products: [PRODUCT_PAYLOAD.product] });
    const { port: retry } = port(found, cache);
    expect((await retry.search('obscure'))[0]?.name).toBe('Rye bread');
  });

  it('falls back to the search service when the classic endpoint is throttled', async () => {
    const fetchJson = vi
      .fn<FetchJson>()
      .mockRejectedValueOnce(new Error('HTTP 503')) // cgi/search.pl down
      .mockResolvedValueOnce({ hits: [PRODUCT_PAYLOAD.product] }); // search-a-licious shape
    const { port: off } = port(fetchJson);
    const results = await off.search('bread');
    expect(results[0]?.name).toBe('Rye bread');
    expect(fetchJson.mock.calls[1]?.[0]).toContain('search.openfoodfacts.org/search?q=bread');
  });

  it('caches search results per normalized query', async () => {
    const fetchJson = vi.fn<FetchJson>().mockResolvedValue({
      products: [PRODUCT_PAYLOAD.product],
    });
    const { port: off } = port(fetchJson);
    await off.search('Bread');
    expect((await off.search('  bread '))[0]?.name).toBe('Rye bread');
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
});
