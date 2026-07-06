import type { FeedPort } from '@almanac/core';

/**
 * The web FeedPort adapter (P8 subscriptions): fetch an ICS document over HTTP.
 * Any failure — offline, 404, CORS — rejects, and the subscriptions store falls
 * back to its last cached copy (L5). Cross-origin feeds require the server to
 * send permissive CORS headers; those that don't simply stay on their cache.
 */
export function createFeedPort(): FeedPort {
  return {
    fetch: async (url) => {
      const response = await fetch(url, { headers: { Accept: 'text/calendar' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },
  };
}
