/**
 * The viewer's IANA time zone — the app layer is the sanctioned edge for
 * reading it (L4: the core never touches the system zone; it's injected).
 * Timed spans resolve their display days against this (5.2 fallback chain).
 */
export const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
