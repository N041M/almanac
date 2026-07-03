# Build journal

How Almanac changed as it was built — the *narrative* behind the terse
[CHANGELOG](../CHANGELOG.md) and the *rationale* in [DECISIONS](DECISIONS.md).
Newest phase first. Keep entries honest: what we did, what we chose, what we
deferred, and anything we're unsure about.

---

## Phase 2 — Desktop calendar shell (in progress)

**Goal:** the calendar rendering Days end-to-end, in the shared renderer that is
both the web port and the Tauri desktop frontend (decision D2/D3), with EN + CS.

**What we built** (`packages/apps/web`): a Vite + React + Tailwind v4 renderer;
a month grid driven by the core's `buildMonthGrid` (locale week-start, today and
in/out-of-month styling, prev/next/today nav); react-i18next wired to a live
EN/CS switch (weekday/month names from `Intl`); a `localStorage` `StoragePort`
adapter + a Zustand store; and a small **demo "star a day" slice** that exercises
the whole Day pipeline — write through the `DayStore`, read back on month load,
render with the priority intensity scale.

**Why the demo slice:** no real modules exist yet, so it's the smallest thing
that proves the shell renders **Days from the store**, not just a static grid —
persistence, sparse reads, and slice isolation all exercised through the UI.

**Verified:** typecheck (core program + a separate web program for jsx/DOM),
lint, `vite build`, and **3 jsdom/RTL tests** (grid renders, EN→CS relabels the
UI, and select-then-star round-trips through storage). 43 tests total; the two
Vitest projects (node + web) run under one `pnpm test`.

**Continued (2026-07-02 → 07-03), in order:**
- **Render verified for real:** headless-Chrome screenshots (EN, CS with
  Monday week-start, star persistence) — jsdom proves behaviour, not looks.
- **Full-repo sweep** (dead code / bugs / redundancies): the one real bug was
  an unhandled rejection when a storage *write* failed (now optimistic +
  quiet, L5); plus `<html lang>` sync, single ISO validation path, shared
  `dateFromISO`/`MS_PER_DAY`, recurrence never-throws + window-skip perf,
  removed dead files. Lesson logged: removing vitest `globals` silently
  disabled RTL auto-cleanup — the suite had been leaning on it.
- **D4** (see DECISIONS): L6 relaxed — server-durable, locally-cached;
  `SyncPort` reshaped (batch push / pull-since-revision), `StoragePort` gained
  optional `readMany` (month = one storage call), slice envelopes stamp
  modified-at via injected `Clock` so data is sync-ready from day one.
- **UI foundation:** semantic design tokens (`@theme`, system light+dark),
  `ui/Button` primitive, card shell, keyboard-first grid (single tab stop,
  roving `aria-activedescendant` selection crossing month edges), localized
  cell labels, midnight-refreshing "today". Verified by screenshots in both
  color schemes.
- **Week + day views:** store re-anchored on a single date + view; segmented
  Month/Week/Day switcher; nav steps by view; `Intl.formatRange` week titles;
  calendar split into one-concern files (CalendarView / MonthGrid / WeekGrid /
  DayCell / DayDetail / ViewSwitcher). Screenshots caught two things tests
  couldn't: buttons center content (week numerals floated mid-cell) and the
  day view double-titled itself.
- **Roadmap + D5:** all mainstream-calendar gap features planned
  (docs/ROADMAP.md, 12 phases) incl. multi-user (shared calendars, invites +
  auto-accept whitelist, free-busy, booking) — each with an L5 degradation row
  as acceptance criteria. Two contracts pinned for P6 entry (recurrence v2,
  timed/multi-day/timezone events) so the tasks module can't persist events in
  a pre-v2 shape.
- **Tauri:** compiled on the user's machine once Rust + icons were in
  (`generate_context!` initially failed on missing icons — placeholder set
  generated and committed); real CSP replaces `csp: null`; `Cargo.lock`
  tracked.

**Verified:** `pnpm check` green throughout — **51 tests** (node + web
projects); production `vite build`; screenshots for every visual change.

**Honestly still open for Phase 2:**
- Native **SQLite `StoragePort`** for the desktop build (localStorage stands in).
- A post-CSP `tauri dev` sanity run on the user's machine.
- **Config note:** the app uses extensionless relative imports (Vite/bundler
  idiom) vs the libraries' explicit `.js`; typecheck is a two-step (core program
  + the web program, which alone carries `jsx`/DOM libs — kept out of the core).

**Next:** close the two open items above, then Phase 3 (food kernel) per
[ROADMAP.md](ROADMAP.md).

---

## Phase 1 — Core

**Goal:** build the pure, framework-agnostic hub every module plugs into
(design §5). Done when core compiles with **zero UI deps** and is unit-tested.

**What we built** (all under `packages/core/src`, one concern per file):
ports (six, split per file), time (`ISODate` + UTC date math + fixed clock),
seeded RNG, units (convert/normalize/combine), schedule (`occurrencesInRange`),
the sparse Day record + `DayStore` with isolated versioned slice codecs, the
calendar model (locale week-start grid + priority intensity scale), the signal
registry, and the i18n service (EN fallback + `Intl` formatting).

**How the laws showed up in code**
- **L4** everywhere: `Clock`/`Rng` injected; `createFixedClock` +
  `createSeededRng` make time and randomness reproducible — no `Date.now()`/
  `Math.random()` in logic.
- **L5** is the throughline: absent day-slice = normal; a corrupt/unknown-
  version/failed slice read degrades to the module default **in isolation**
  (proved by a test where one bad slice leaves its neighbour intact); the
  registry returns `undefined` when no provider (or a throwing one) exists;
  units refuse rather than crash on incompatible/unknown units.
- **L3/L8**: zero external deps in core (lint-enforced), strict TS throughout.

**Verified:** 40 unit tests; `pnpm check` green; the L1 boundary + L3
core-purity lint rules still pass with real code in place.

**Deferred (by design):** slice **migrations** — for now an unknown stored
version degrades to default (L5-correct, but lossy); real per-version migration
lands with persistence work. `todayISO` is UTC; a locale/timezone offset comes
with the shell. No adapters yet (Storage/Weather/Nutrition) beyond the in-memory
test storage — those are Phase 2+.

**Next:** Phase 2 — the desktop calendar shell (Tauri + Vite/React) rendering
Days end-to-end, wiring i18n (EN + CS), behind a `StoragePort` adapter.

---

## Phase 0 — Scaffold

**Goal:** make the design doc's laws mechanically true before any feature code
exists. Done when the check suite is green **and** a deliberate sibling import
fails the build.

**What we built**
- pnpm-workspace monorepo: `@almanac/core`, `@almanac/food` (kernel),
  `@almanac/meals` (module), `@almanac/desktop` + `@almanac/web` (app stubs).
- Strict TS via project references (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, no `any`/non-null).
- ESLint `boundaries` encoding the §4 dependency matrix (L1).
- Vitest + GitHub Actions CI (`typecheck` + `lint` + `test`).
- i18n stubs (EN + CS) for core and the meals namespace.
- `Clock` / `Rng` ports (the L4 determinism seam).
- Docs: README, this journal, ARCHITECTURE (+ UML), DECISIONS.

**Verified (not asserted)**
- `pnpm check` green.
- The boundary rule rejects a `module → module` import **both** via a relative
  path *and* via the package name (`@almanac/meals`) — tested, then reverted.

**Decisions taken during this phase** (details in [DECISIONS](DECISIONS.md))
- **Calendar is the core; meals is the first module** (D0) — reorders the doc's
  food-centric phase order so the calendar shell precedes the meal engine.
- **Sync = full opt-in** (D1) — still local-first; sync is additive and late.
- **Client = desktop app + web port**, core kept platform-agnostic (D2).
- **Desktop shell = Tauri, reversing an initial Electron pick** (D3) — driven by
  memory footprint: Electron bundles Chromium (~hundreds of MB baseline), Tauri
  uses the system webview (~tens of MB). The desktop has no heavy native need
  (barcode is mobile-only), and the app was still a stub, so switching cost ~0.
  Bonus: removed the "Electron main runs plain Node, can't consume raw `.ts`"
  build snag.

**Hardening pass** (resolved after the scaffold review)
- ✅ **#4 — pure typecheck.** `pnpm typecheck` runs `tsc --noEmit` over the whole
  repo and leaves **zero** `dist/`/`.tsbuildinfo`.
- ✅ **Source-based TS (editor fix).** Dropped `composite`/project references and
  `baseUrl`; `paths` (relative values) resolve `@almanac/*` to `src`. This kills
  the TS6305 "output not built" editor error that references caused once
  typecheck stopped emitting, and clears the TS7 `baseUrl` deprecation. Apps will
  get real build config from their bundler (Vite/Tauri) in Phase 2.
- ✅ **#5 — L3 enforced.** A `boundaries/external` rule fails the build if
  `packages/core/src` (non-test) imports any external npm package. Probed:
  `import … from 'vitest'` in core is rejected.
- ◐ **#3 — CI install verified locally.** The exact CI command
  (`pnpm install --frozen-lockfile`) passes locally; native-build approval
  (esbuild/unrs-resolver) is authorized in `pnpm-workspace.yaml`. Full
  fresh-machine run confirmed on first push.

**Still deferred (by design)**
- App runtime/build strategy (bundle-everything via Vite; Tauri backend is Rust)
  — settled in principle, wired in Phase 2.

**Next:** Phase 1 — the core: day record + day-store contract, calendar model,
schedule/recurrence, units, registry, i18n service, and the full port set.
