import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSubscriptions } from './subscriptions';

const FEED = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:h@x',
  'SUMMARY:Holiday',
  'DTSTART;VALUE=DATE:20260706',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

beforeEach(() => {
  globalThis.localStorage.clear();
  useSubscriptions.setState({ loaded: true, feeds: [] });
});

describe('subscriptions store (P8, L5 offline → cache)', () => {
  it('subscribes and parses the feed on a successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(FEED, { status: 200 }))));
    await useSubscriptions.getState().addFeed('https://example.com/cal.ics', 'Holidays');
    const feed = useSubscriptions.getState().feeds[0];
    expect(feed?.events).toHaveLength(1);
    expect(feed?.events[0]?.title).toBe('Holiday');
    expect(feed?.stale).toBe(false);
  });

  it('keeps the cached copy and flags stale when a later refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(FEED, { status: 200 }))));
    await useSubscriptions.getState().addFeed('https://example.com/cal.ics', 'Holidays');
    const id = useSubscriptions.getState().feeds[0]?.id as string;

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await useSubscriptions.getState().refresh(id);
    const feed = useSubscriptions.getState().feeds[0];
    expect(feed?.events).toHaveLength(1); // cached events survive
    expect(feed?.stale).toBe(true);
  });

  it('removing a feed drops only that feed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(FEED, { status: 200 }))));
    await useSubscriptions.getState().addFeed('https://a.com/1.ics', 'A');
    await useSubscriptions.getState().addFeed('https://b.com/2.ics', 'B');
    const first = useSubscriptions.getState().feeds[0]?.id as string;
    await useSubscriptions.getState().removeFeed(first);
    expect(useSubscriptions.getState().feeds.map((f) => f.name)).toEqual(['B']);
  });
});
