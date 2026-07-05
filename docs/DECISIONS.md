# Decisions

Lightweight decision log — the forks the design doc left open (or that we chose
to depart on), with rationale. Newest first. Keep entries short.

---

## D7 — Event/task shape pinned before the first event persists

**Decided:** 2026-07-05 · **Status:** accepted · **Design ref:** §8 tasks, ROADMAP P6 entry

The tasks module's three primitives (task · event · habit — distinct kinds
that must not blur) share a base shape carrying the fields whose late addition
would cost a migration:
- `calendarId?` — multiple calendars (color + visibility are calendar-level
  state, not per-entry).
- `transparency?: 'busy' | 'free'` — feeds P12 free-busy; default busy.
- `visibility?: 'private'` — show-as-busy-only under P12 sharing.
- `place?` — physical location (maps later). The §8 `@home/@work` axis is a
  separate field, `contexts: string[]` — context ≠ place.
- Timed *events* use the 5.2 contract (`TimedSpan`, absolute UTC + display
  zone). Task due *times* are deliberately **floating wall-clock**
  (`{date, minutes}`): "pay rent at 09:00" means 09:00 wherever you wake up.
- Recurrence rides the core primitive; per-instance edits are 5.1 override
  records stored with the owning item.

## D6 — Deletion syncs as tombstones (entity records are never hard-removed)

**Decided:** 2026-07-05 · **Status:** accepted · **Design ref:** §11, D4, ROADMAP P6/P10 markers

Per-slice LWW can resurrect hard-deleted records (a stale device re-pushes an
old revision). So, for **entity records** (tasks items now; catalog records
before P10):
- Delete = write a **tombstone envelope** `{v, d: null, m, del: true}` — an
  ordinary LWW write that carries its modified-at. Readers treat it as absent;
  saving again later revives the id (that's an edit, not a resurrection).
- **Per-day slices** need no tombstones: writing the empty slice *is* the
  deletion and already carries `m`.
- Tombstone GC is a server concern, specced at P10 entry (needs the sync
  horizon).

## D5 — Multi-user features planned (supersedes design doc §15's exclusion)

**Decided:** 2026-07-03 · **Status:** accepted · **Design ref:** §15 · Builds on D1/D4

Shared calendars, attendees/invitations/RSVP, free-busy + find-a-time, booking
pages, and conferencing links are **in scope**, as Phase 12 in
[ROADMAP.md](ROADMAP.md) — after sync (P10), whose accounts + per-slice
revision streams they build on. All additive per L5: signed-out/offline clients
keep full single-user behaviour. Client logic stays modular (L1–L3); the new
surface is server-side (ACLs, invite routing, availability, booking endpoint),
specced at P12 entry. External invites reuse P8's ICS work via iMIP.

**Why:** user: "also add multi-user features" — reversing §15's deliberate
exclusion after the roadmap made the trade-offs visible.

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
