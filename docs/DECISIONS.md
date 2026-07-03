# Decisions

Lightweight decision log — the forks the design doc left open (or that we chose
to depart on), with rationale. Newest first. Keep entries short.

---

## D4 — L6 relaxed; sync architecture pinned (server-durable, locally-cached)

**Decided:** 2026-07-03 · **Status:** accepted · **Design ref:** §2 L6, §11 · Refines D1

L6's strict local-first dogma is relaxed. The store stays on-device (instant UI,
works offline — the cheap substrate), but there is **no special
health-data-never-leaves posture**, and the **server copy is the durable one**
once sync (D1) exists.

Sync architecture, pinned now so Phases 3–6 can't drift away from it:
- **Per-slice revision sync.** The unit of sync = the per-day, per-module slice
  (already the storage unit). Server keeps an authoritative revision log;
  clients pull deltas since their last revision and push changed slices
  (debounced) after writes, on app-open, and on network-regain.
- **Conflicts: last-writer-wins per slice, silently.** Single-user data; a true
  conflict needs the same module's slice for the same day edited on two offline
  devices — rare, and newest-wins matches user expectation. No merge UI.
- **Per-client posture:** desktop/mobile hold a full local store; the **web
  port** treats local storage as a cache and reads through the server when cold
  (browser storage is evictable).
- Slice envelopes carry a modified-at timestamp from day one so the first sync
  can LWW against real times instead of treating all history as conflicting.

**Why:** the user judged strict local-first unnecessary and flagged the real
risk — cross-platform sync feeling clunky. Clunky sync comes from coarse blobs
and bolted-on sync; slice granularity + pinned revisions prevent exactly that.
Cloud-first was considered and rejected: it adds a backend and kills offline
without removing the reconciliation problem.

## D3 — Desktop shell is Tauri (supersedes an initial Electron pick)

**Decided:** 2026-07-01 · **Status:** accepted · **Design ref:** §3

The desktop shell is **Tauri**, wrapping the shared Vite + React renderer; the
same renderer ships as the **web port**. Core/kernels/module logic stay
platform-agnostic (L3), so the shell is just a host.

Reverses a same-day initial choice of Electron. Reason: **memory footprint.**
Electron bundles Chromium + Node (a fixed ~hundreds-of-MB baseline); Tauri uses
the OS-native webview (WebView2/WebKit) for a ~tens-of-MB baseline. The desktop
has **no heavy native requirement** (barcode scanning is mobile-only per §8;
desktop falls back to name search), so Electron's main advantage doesn't apply
here. Cost of switching was ~zero — the app was still a stub. Bonus: removes the
"Electron main process runs plain Node and can't consume raw `.ts`" build snag,
since Tauri's backend is Rust and the frontend is Vite-bundled.

Tradeoffs accepted: a light Rust toolchain for the backend, and testing render
on each OS's system webview instead of "Chromium everywhere."

## D2 — Client architecture: desktop app + web port

**Decided:** 2026-07-01 · **Status:** accepted · **Design ref:** §3, §13

Primary client is a **full desktop app with a web port**, not the doc's
web-SPA-first + Expo-mobile plan. The core must be **non-platform-reliant and
highly modular** so one core drives desktop, web, and (later) mobile. Mobile
(React Native/Expo) drops to a later, optional phase.

## D1 — Sync model: full opt-in (design §11 option 3)

**Decided:** 2026-07-01 · **Status:** accepted · **Design ref:** §11

Resolved the open sync fork to **option 3: accounts + cross-device sync**
(doc default was option 1, no server). Still built local-first — everything
works single-device/offline; sync stays **additive** (L5/L6) and lands in a late
phase. A `SyncPort` is reserved in core; storage stays schema-versioned and
per-module sliced so it's sync-ready. Health/sensitive data must be opt-in +
encrypted before it ever leaves the device (L6).

## D0 — Calendar is the core; meals is the first module

**Decided:** 2026-07-01 · **Status:** accepted · **Design ref:** §1, §13

The central idea is **a calendar**. The calendar shell (day record + month/week/
day views) is the foundation and is built/rendered first; **meal-planning is the
first major module** bolted on — not the v1 centerpiece the doc's phase order
implies. This reorders §13 so the calendar shell UI precedes the food kernel and
meal engine.
