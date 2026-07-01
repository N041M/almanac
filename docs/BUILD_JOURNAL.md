# Build journal

How Almanac changed as it was built — the *narrative* behind the terse
[CHANGELOG](../CHANGELOG.md) and the *rationale* in [DECISIONS](DECISIONS.md).
Newest phase first. Keep entries honest: what we did, what we chose, what we
deferred, and anything we're unsure about.

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
- Docs: README, agent context, this journal, ARCHITECTURE (+ UML), DECISIONS.

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

**Deferred / known-open** (from the scaffold review)
- App runtime/build strategy (bundle-everything via Vite; Tauri backend is Rust)
  — settled in principle, wired in Phase 2.
- CI never actually run yet (nothing pushed) — the native-build approval
  (esbuild/unrs-resolver) is authorized in `pnpm-workspace.yaml` but unverified
  end-to-end until the first push.
- `pnpm typecheck` uses `tsc -b`, which emits `dist/` + `.tsbuildinfo`
  (gitignored) rather than being a pure no-op check.
- L3 "core has zero runtime deps" isn't yet lint-enforced (boundaries only
  governs cross-package imports, not external npm deps).

**Next:** Phase 1 — the core: day record + day-store contract, calendar model,
schedule/recurrence, units, registry, i18n service, and the full port set.
