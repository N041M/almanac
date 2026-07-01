// Ports are the seams that keep the core pure and platform-agnostic (L3) and
// deterministic (L4). Adapters live in kernels/apps. Fuller definitions land
// in Phase 1; these two anchor determinism from the start.

/** L4: all "now" flows through an injected clock — never `Date.now()` in logic. */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

/** L4: all randomness flows through an injected Rng — never `Math.random()`. */
export interface Rng {
  /** A float in [0, 1). */
  (): number;
}
