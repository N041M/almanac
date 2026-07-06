import { create } from 'zustand';
import { parseIcs, type CalendarEvent } from '@almanac/calendar-interop';
import { storagePort } from './persistence';
import { createFeedPort } from '../feed/create-feed-port';
import { systemClock } from '../clock';

const FEEDS_KEY = 'subscriptions:feeds';
const FEEDS_VERSION = 1;
const feedPort = createFeedPort();

/** A subscribed read-only ICS feed. `cachedIcs` keeps it working offline (L5). */
interface StoredFeed {
  id: string;
  url: string;
  name: string;
  lastFetchedUtc: number | null;
  cachedIcs: string | null;
}

export interface Feed extends StoredFeed {
  /** Derived from `cachedIcs` — the feed's events, expanded by the grid on demand. */
  events: CalendarEvent[];
  /** True when the last refresh failed and we're showing the cached copy. */
  stale: boolean;
}

interface Envelope {
  v: number;
  d: unknown;
  m?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function decodeFeeds(raw: string | null): StoredFeed[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed['v'] !== FEEDS_VERSION || !Array.isArray(parsed['d'])) return [];
    const out: StoredFeed[] = [];
    for (const item of parsed['d']) {
      if (!isRecord(item) || typeof item['id'] !== 'string' || typeof item['url'] !== 'string') {
        continue; // a malformed feed costs only itself (L5)
      }
      out.push({
        id: item['id'],
        url: item['url'],
        name: typeof item['name'] === 'string' ? item['name'] : item['url'],
        lastFetchedUtc: typeof item['lastFetchedUtc'] === 'number' ? item['lastFetchedUtc'] : null,
        cachedIcs: typeof item['cachedIcs'] === 'string' ? item['cachedIcs'] : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function hydrate(stored: StoredFeed): Feed {
  const events = stored.cachedIcs !== null ? parseIcs(stored.cachedIcs).events : [];
  return { ...stored, events, stale: false };
}

export interface SubscriptionsState {
  loaded: boolean;
  feeds: Feed[];
  load: () => Promise<void>;
  addFeed: (url: string, name: string) => Promise<void>;
  removeFeed: (id: string) => Promise<void>;
  refresh: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  /** Every subscribed event, flattened (for the grid + search). */
  allEvents: () => CalendarEvent[];
}

async function persist(feeds: ReadonlyArray<Feed>): Promise<void> {
  const stored: StoredFeed[] = feeds.map(({ id, url, name, lastFetchedUtc, cachedIcs }) => ({
    id,
    url,
    name,
    lastFetchedUtc,
    cachedIcs,
  }));
  const envelope: Envelope = { v: FEEDS_VERSION, d: stored, m: systemClock.now() };
  try {
    await storagePort.write(FEEDS_KEY, JSON.stringify(envelope));
  } catch {
    // Persistence unavailable; in-memory feeds already reflect the change (L5).
  }
}

export const useSubscriptions = create<SubscriptionsState>((set, get) => {
  async function refreshOne(feed: Feed): Promise<Feed> {
    try {
      const ics = await feedPort.fetch(feed.url);
      return {
        ...feed,
        cachedIcs: ics,
        events: parseIcs(ics).events,
        lastFetchedUtc: systemClock.now(),
        stale: false,
      };
    } catch {
      // Offline / 404 / CORS → keep the cached copy, flag it stale (L5).
      return { ...feed, stale: true };
    }
  }

  return {
    loaded: false,
    feeds: [],

    load: async () => {
      if (get().loaded) return;
      let raw: string | null = null;
      try {
        raw = await storagePort.read(FEEDS_KEY);
      } catch {
        raw = null;
      }
      set({ loaded: true, feeds: decodeFeeds(raw).map(hydrate) });
      // Refresh in the background; cached events already render.
      void get().refreshAll();
    },

    addFeed: async (url, name) => {
      const trimmed = url.trim();
      if (trimmed === '') return; // empty add: a quiet no-op (L5)
      const feed: Feed = {
        id: crypto.randomUUID(),
        url: trimmed,
        name: name.trim() === '' ? trimmed : name.trim(),
        lastFetchedUtc: null,
        cachedIcs: null,
        events: [],
        stale: false,
      };
      set((s) => ({ feeds: [...s.feeds, feed] }));
      await get().refresh(feed.id);
    },

    removeFeed: async (id) => {
      // Feed removal deletes only that feed's entries (slice isolation, L5).
      const feeds = get().feeds.filter((f) => f.id !== id);
      set({ feeds });
      await persist(feeds);
    },

    refresh: async (id) => {
      const feed = get().feeds.find((f) => f.id === id);
      if (feed === undefined) return;
      const next = await refreshOne(feed);
      const feeds = get().feeds.map((f) => (f.id === id ? next : f));
      set({ feeds });
      await persist(feeds);
    },

    refreshAll: async () => {
      const refreshed = await Promise.all(get().feeds.map(refreshOne));
      // Only overwrite feeds that still exist (one may have been removed mid-flight).
      const byId = new Map(refreshed.map((f) => [f.id, f]));
      const feeds = get().feeds.map((f) => byId.get(f.id) ?? f);
      set({ feeds });
      await persist(feeds);
    },

    allEvents: () => get().feeds.flatMap((f) => f.events),
  };
});
