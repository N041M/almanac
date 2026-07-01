# Almanac

A **local-first personal calendar**. The calendar is the core; every feature is
an independent **module** that plugs into a shared hub and never depends on
another module. Meal-planning is the first module. Full spec in
[ALMANAC_DESIGN_DOC.md](ALMANAC_DESIGN_DOC.md).

## The laws (non-negotiable — enforced where possible)

- **L1 — Star modularity.** Every module depends on the core (and kernels) and
  nothing else. No module imports another module. Enforced by package
  boundaries + the ESLint `boundaries` rule: a sibling import is a failed build.
- **L2 — Composition over inheritance.** No class hierarchies; rules/scorers/
  providers are plain functions or registered objects.
- **L3 — Pure, framework-agnostic core.** Core + module logic are plain TS with
  zero UI-framework deps. Dependencies point inward only.
- **L4 — Determinism by injection.** All randomness via an injected `Rng`, all
  "now" via an injected `Clock`. No `Math.random()`/`Date.now()` in logic.
- **L5 — Graceful degradation, everywhere.** Every component has a defined,
  quiet, lower-capability state for missing/partial/erroring inputs. Failures
  are isolated, never cascading.
- **L6 — Local-first.** Data lives on-device; health data never leaves by
  default. Sync (opt-in) is additive.
- **L7 — i18n from day one.** No hardcoded strings; missing key → English.
- **L8 — Strict TypeScript.** `strict` + `noUncheckedIndexedAccess`, no `any`.

## Dependency direction

```
apps  ─────►  modules  ─────►  kernels  ─────►  core
(desktop,web) (meals, …)       (food, …)        (day, calendar, ports, i18n, …)

Boundary matrix (lint-enforced):
  core    may import  nothing but itself
  kernel  may import  core
  module  may import  core, kernels           (NEVER another module)
  app     may import  core, kernels, modules
```

**Why star-modularity + composition-over-inheritance:** modules stay
independently buildable, testable, and removable — the app runs with any single
module absent — and there is no base class to override, therefore none to break.
Shared needs move *down* into the core or a kernel, never sideways.

## Stack

pnpm workspaces · TypeScript (strict) · React + Vite · **Electron** desktop app
with a **web port** (shared renderer) · Vitest · ESLint `boundaries` ·
i18next (EN + CS) · Open Food Facts (nutrition) · Open-Meteo (weather).

## Develop

```sh
pnpm install
pnpm check      # typecheck + lint + test
```

Individually: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Status

Phase 0 (scaffold) — workspaces, strict TS, boundary lint, Vitest, CI, i18n
stubs. Build phases are tracked in the design doc §13.
