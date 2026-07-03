# Changelog

All notable changes to Almanac. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses
[conventional commits](https://www.conventionalcommits.org/) and is pre-1.0
(anything may change).

Entries are grouped by **build phase** (design doc §13) until v1.

## [Unreleased]

### D4 — L6 relaxed; sync architecture pinned
- **Decision** (docs/DECISIONS.md D4): local store stays (offline + instant UI)
  but the server copy is durable once sync exists; per-slice **LWW revision
  sync**; web port reads through the server when cold; health-data dogma
  dropped. L6 reworded in README/CLAUDE/ARCHITECTURE.
- **`SyncPort` reshaped** to the pinned model: batch `push` (server assigns
  revisions) + `pull(sinceRevision)` returning records and the next cursor.
- **`StoragePort.readMany`** (optional, with per-key fallback): `getRange`
  batches a month into one storage call instead of days×slices sequential
  awaits — both adapters (memory, localStorage) implement it.
- **Slice envelopes carry modified-at** (`m`, epoch ms) via an injected `Clock`
  (L4), so data written from now on can LWW against real times at first sync;
  timestampless envelopes remain readable.

### Sweep — dead code, bugs, redundancies (post-review fixes)
- **core:** one `parseISO` validation path (was double-validating); `MS_PER_DAY`
  exported and used everywhere (no inline `86_400_000`); new **`dateFromISO`**
  as the single ISODate→`Date` bridge (core i18n + web app now share it);
  recurrence honours its "never throws" contract (malformed dates → `[]`, L5)
  and skips straight to the query window when no `count` cap applies;
  `buildMonthGrid` pads the year.
- **web:** a failed persistence write degrades to session-only state instead of
  an unhandled rejection (L5); `<html lang>` follows the language switch;
  Intl formatters memoized; gridcell labels are localized dates; "today"
  refreshes across midnight; grid computed once per navigation
  (`loadRange(first, last)`); dead `systemClock` + duplicate `dateFromISO`
  removed; RTL cleanup made explicit (vitest globals off).
- **dead code deleted:** `packages/core/src/i18n/locales/*` (unreferenced since
  the web app ships its own bundles).
- **desktop:** real CSP instead of `null` (self-only + Tauri IPC; external API
  origins get added per-adapter later); `Cargo.lock` committed for reproducible
  native builds.
- 46 tests.

### Phase 2 — Desktop calendar shell (in progress)
- Shared **Vite + React + Tailwind v4** renderer (`@almanac/web`) — the web port,
  and the frontend the Tauri desktop shell loads.
- **Month calendar** from the core (`buildMonthGrid`): locale week-start, today +
  in/out-of-month styling, prev/next/today nav; selected-day panel with an
  actionable empty state.
- **i18n** wired (i18next + react-i18next), EN + CS, live language switch;
  weekday/month names via `Intl`.
- **`localStorage` `StoragePort` adapter** + Zustand store; a demo "star a day"
  slice proves the Day pipeline end-to-end (render → persist → reload) with slice
  isolation.
- **Vitest projects** (node + jsdom/react); 3 RTL component tests — **43 total**.
- **Tauri v2 shell** scaffolded (`apps/desktop/src-tauri`) wrapping the web build.
  Native build needs the Rust toolchain (not installed here) — the web port is
  verified via `vite build` + jsdom tests instead.
- Still to do: week/day views; native run once Rust is present; a native
  `StoragePort` adapter for desktop.

### Phase 1 — Core
- **Ports** (one file each): `Clock`, `Rng`, `StoragePort`, `WeatherPort`,
  `NutritionPort`, and a reserved `SyncPort` (D1).
- **Time:** `ISODate` (UTC, validated) + date math (add/diff days, weekday,
  week/month bounds, month add with day-clamp); deterministic `createFixedClock`.
- **RNG:** seedable `createSeededRng` (mulberry32) — reproducible streams (L4).
- **Units:** mass/volume/count with conversion, normalization, and
  `tryCombine` (compatible → merged; incompatible → kept separate).
- **Schedule:** one RRULE-style `occurrencesInRange` (daily/weekly+byWeekday/
  monthly, interval, count, until) behind todos/events/habits/shopping.
- **Day record + store:** sparse `Day` (absent slice = normal, L5); `DayStore`
  over `StoragePort` with **isolated, versioned slice codecs** — corrupt/
  unknown-version/failed reads degrade to the module default without touching
  neighbours; in-memory storage adapter for tests.
- **Calendar model:** locale week-start `buildWeek`/`buildMonthGrid`; the shared
  priority intensity scale (P1 solid → P3 faded; absent → full).
- **Registry:** context-signal provider/consumer mediation; no provider (or a
  throwing one) → `undefined`, a handled state (L5).
- **i18n service:** `"namespace:key"` resolution with `{{param}}` interpolation,
  English fallback, and `Intl` date/number formatting; `Locale` = text +
  formatting + region (week-start, metric/imperial). EN_US / CS_CZ presets.
- Pure, zero UI-framework deps (L3); deterministic (L4); **40 unit tests**;
  `pnpm check` green.

### Phase 0 — Scaffold
- pnpm workspace monorepo: `@almanac/core`, `@almanac/food` (kernel),
  `@almanac/meals` (module), `@almanac/desktop` + `@almanac/web` (app stubs).
- Strict TypeScript (project references; `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, no `any`).
- ESLint `boundaries` rule enforcing the §4 dependency matrix (L1): a
  sibling-module import is a failed build — verified.
- Vitest test runner; GitHub Actions CI (`typecheck` + `lint` + `test`).
- i18n stubs: EN + CS locale files (core + meals namespaces).
- `Clock` / `Rng` ports stubbed (L4 determinism seam).
- Hardening: source-based TS (no `composite`/references/`baseUrl`; `paths` → src;
  `tsc --noEmit` typecheck leaves no artifacts and avoids TS6305 in editors);
  L3 enforced via a `boundaries/external` rule (core/src imports no external
  packages); CI install verified with `--frozen-lockfile`.
- Docs: lightweight README; `docs/` with ARCHITECTURE (the laws +
  Mermaid UML: component, class, engine-flow), BUILD_JOURNAL (per-phase
  narrative), DECISIONS, and an index.

### Not yet built
Phase 2 onward (desktop calendar shell + i18n wiring; then food kernel, meal
engine, …). Apps are stubs — no Tauri/Vite/React wiring yet. Kernels/modules
still stubs.
