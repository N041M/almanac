import type { NutritionPort, NutritionResult, StoragePort } from '@almanac/core';

/**
 * The HTTP seam the adapter needs, injected per L3/L4 — no global `fetch` in
 * kernel logic. Resolves to parsed JSON; any rejection or throw is treated as
 * "no data" by the adapter (L5), so implementations can stay one-liners.
 */
export type FetchJson = (
  url: string,
  headers: Readonly<Record<string, string>>,
) => Promise<unknown>;

export interface OpenFoodFactsOptions {
  fetchJson: FetchJson;
  /** OFF asks read clients to identify themselves with a descriptive UA (§7). */
  userAgent: string;
  /**
   * Every successful lookup is cached here (§7) — repeat lookups never re-hit
   * the network, which is also how the ~15 reads/min rate limit stays
   * theoretical for a personal app. Cache failures are ignored.
   */
  cache?: StoragePort;
  baseUrl?: string;
}

export const OFF_BASE_URL = 'https://world.openfoodfacts.org';
/** The newer Search-a-licious service — the fallback when cgi search is throttled. */
export const OFF_SEARCH_FALLBACK_URL = 'https://search.openfoodfacts.org';
export const OFF_SEARCH_PAGE_SIZE = 10;
const PRODUCT_FIELDS = 'code,product_name,nutriments';
const CACHE_PREFIX = 'food:off:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Crowd-sourced data: take each field only if it's actually there (§7). */
function toResult(product: unknown, fallbackName?: string): NutritionResult | null {
  if (!isRecord(product)) return null;
  const rawName =
    typeof product['product_name'] === 'string' ? product['product_name'].trim() : '';
  const name = rawName !== '' ? rawName : fallbackName;
  if (name === undefined || name === '') return null;

  const result: NutritionResult = { name };
  if (typeof product['code'] === 'string' && product['code'] !== '') {
    result.barcode = product['code'];
  }
  const nutriments = product['nutriments'];
  if (isRecord(nutriments)) {
    const kcal = asFinite(nutriments['energy-kcal_100g']);
    const proteinG = asFinite(nutriments['proteins_100g']);
    const carbsG = asFinite(nutriments['carbohydrates_100g']);
    const fatG = asFinite(nutriments['fat_100g']);
    if (kcal !== undefined || proteinG !== undefined || carbsG !== undefined || fatG !== undefined) {
      result.per100g = {
        ...(kcal !== undefined && { kcal }),
        ...(proteinG !== undefined && { proteinG }),
        ...(carbsG !== undefined && { carbsG }),
        ...(fatG !== undefined && { fatG }),
      };
    }
  }
  return result;
}

/** Validate a cached payload; corrupt cache entries are ignored, not trusted. */
function decodeCached(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isResult(value: unknown): value is NutritionResult {
  return isRecord(value) && typeof value['name'] === 'string';
}

/**
 * Open Food Facts behind the core's `NutritionPort` (§7). Lookup is enrichment,
 * never a gate: **every failure path — offline, HTTP error, missing product,
 * malformed payload — resolves to `null`/`[]`, never a throw** (L5); the caller
 * falls back to manual entry.
 */
export function createOpenFoodFactsPort(options: OpenFoodFactsOptions): NutritionPort {
  const { fetchJson, userAgent, cache } = options;
  const base = options.baseUrl ?? OFF_BASE_URL;
  const headers = { 'User-Agent': userAgent, Accept: 'application/json' } as const;

  async function readCache(key: string): Promise<unknown> {
    if (cache === undefined) return undefined;
    try {
      return decodeCached(await cache.read(key));
    } catch {
      return undefined;
    }
  }

  async function writeCache(key: string, value: unknown): Promise<void> {
    if (cache === undefined) return;
    try {
      await cache.write(key, JSON.stringify(value));
    } catch {
      // A full/broken cache never blocks a lookup (L5).
    }
  }

  return {
    byBarcode: async (barcode) => {
      const trimmed = barcode.trim();
      if (trimmed === '') return null;
      const cacheKey = `${CACHE_PREFIX}product:${trimmed}`;
      const cached = await readCache(cacheKey);
      if (isResult(cached)) return cached;

      try {
        const url = `${base}/api/v2/product/${encodeURIComponent(trimmed)}?fields=${PRODUCT_FIELDS}`;
        const payload = await fetchJson(url, headers);
        if (!isRecord(payload) || payload['status'] !== 1) return null;
        const result = toResult(payload['product'], trimmed);
        if (result !== null) await writeCache(cacheKey, result);
        return result;
      } catch {
        return null;
      }
    },

    search: async (query) => {
      const trimmed = query.trim();
      if (trimmed === '') return [];
      const cacheKey = `${CACHE_PREFIX}search:${trimmed.toLowerCase()}`;
      const cached = await readCache(cacheKey);
      // An empty cached set is not an answer — data may exist by now, and the
      // manual "guess again" retry must be able to actually re-query.
      if (Array.isArray(cached) && cached.length > 0 && cached.every(isResult)) return cached;

      // The classic endpoint first (CORS-friendly but often throttled), then
      // the newer search service — one flaky upstream must not read as "the
      // feature doesn't work" (L5: degrade late, not early).
      const urls = [
        `${base}/cgi/search.pl?search_terms=${encodeURIComponent(trimmed)}` +
          `&search_simple=1&action=process&json=1&page_size=${OFF_SEARCH_PAGE_SIZE}` +
          `&fields=${PRODUCT_FIELDS}`,
        `${OFF_SEARCH_FALLBACK_URL}/search?q=${encodeURIComponent(trimmed)}` +
          `&page_size=${OFF_SEARCH_PAGE_SIZE}&fields=${PRODUCT_FIELDS}`,
      ];
      for (const url of urls) {
        try {
          const payload = await fetchJson(url, headers);
          if (!isRecord(payload)) continue;
          const list = payload['products'] ?? payload['hits'];
          if (!Array.isArray(list)) continue;
          // Nameless search hits are useless — skipped, the rest stand (L5).
          const results = list
            .map((product) => toResult(product))
            .filter((result): result is NutritionResult => result !== null);
          if (results.length > 0) await writeCache(cacheKey, results);
          return results;
        } catch {
          // try the next endpoint
        }
      }
      return [];
    },
  };
}
