/**
 * Read-only calendar feed seam (roadmap P8 subscriptions). One outbound call —
 * fetch an ICS document by URL — behind a port, so the core stays pure (L3) and
 * the feature degrades per L5: a throw (offline, 404, CORS) is the caller's cue
 * to fall back to the last cached copy. The adapter (fetch/HTTP) lives in the
 * app; the core only defines the shape.
 */
export interface FeedPort {
  /** The raw ICS text at `url`. Rejects on any network/HTTP failure. */
  fetch(url: string): Promise<string>;
}
