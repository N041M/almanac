# Architecture

How Almanac is put together, and the laws that keep it that way. Diagrams are
[Mermaid](https://mermaid.js.org/) (GitHub renders them inline).

> **Legend for "built vs planned":** ✅ implemented today · 🔵 specified contract,
> not yet coded (design doc §5–§7). Phase 0 is a scaffold, so most domain types
> are still 🔵.

## The laws

Non-negotiable; enforced where possible (design doc §2).

- **L1 — Star modularity.** A module imports **core + kernels only, never another
  module.** Shared needs move *down*, never sideways. Enforced by the ESLint
  `boundaries` rule — a sibling import is a failed build.
- **L2 — Composition over inheritance.** No class hierarchies; rules/scorers/
  providers are plain functions or registered objects.
- **L3 — Pure, framework-agnostic core.** Core + module logic are plain TS, zero
  UI-framework deps. Dependencies point inward only.
- **L4 — Determinism by injection.** Randomness via an injected `Rng`, "now" via
  an injected `Clock`. No `Math.random()`/`Date.now()` in logic.
- **L5 — Graceful degradation, everywhere.** Every component has a defined, quiet,
  lower-capability state for missing/partial/erroring input. Failures isolate.
- **L6 — Locally-cached, server-durable (relaxed, D4).** On-device store for
  instant UI + offline; opt-in sync makes the server copy durable (per-slice
  LWW by revision).
- **L7 — i18n from day one.** No hardcoded strings; missing key → English.
- **L8 — Strict TypeScript.** `strict` + `noUncheckedIndexedAccess`; no `any`.

## Dependency star (component view)

Arrows read **"depends on"** and point strictly inward. This is the shape L1/L3
guarantee and the boundary lint enforces.

```mermaid
flowchart RL
  subgraph Apps["apps (per-client views)"]
    desktop["@almanac/desktop<br/>(Tauri shell)"]
    web["@almanac/web<br/>(web port)"]
  end
  subgraph Modules["modules (spokes — never import each other)"]
    meals["@almanac/meals ✅"]
    future["future: tasks, macros,<br/>shopping, cycle, … 🔵"]
  end
  subgraph Kernels["kernels"]
    food["@almanac/food ✅"]
  end
  core["@almanac/core<br/>(the hub) ✅"]

  desktop --> meals & food & core
  web --> meals & food & core
  meals --> food & core
  future --> food & core
  food --> core

  classDef planned stroke-dasharray:4 3;
  class future planned;
```

**Boundary matrix (lint-enforced):**

| Element | May import |
|---|---|
| `core` | nothing but itself |
| `kernels/*` | `core` |
| `modules/*` | `core`, `kernels/*` — **never another module** |
| `apps/*` | `core`, `kernels/*`, `modules/*` |

## Core ports (built) — the L4/L6 seams

Ports keep the core pure and testable; adapters live in kernels/apps.

```mermaid
classDiagram
  class Clock {
    <<interface>>
    +now() number
  }
  class Rng {
    <<interface>>
    +call() number
  }
  note for Clock "✅ built. L4: all 'now' flows through here"
  note for Rng "✅ built. L4: all randomness flows through here"
```

Also built: **`StoragePort`** (read/write/remove/keys + optional batched
`readMany`), **`SyncPort`** (batch push / pull-since-revision per D4), and the
**`WeatherPort`** / **`NutritionPort`** contracts (adapters land with their
modules). Planned (ROADMAP P6): `NotificationPort`.

## Domain model (contract — 🔵 not yet implemented)

The shape the core + first module will take, per design doc §5 (day record), §6
(meal engine), §7 (food kernel). Shown so the target is legible while we build.

```mermaid
classDiagram
  direction LR

  class Day {
    +ISODate date
    +namespaced fields per module
    +meals: PlanRef
    +tasks: Task[]
    +weather: Snapshot
    note "sparse — absent field = normal state (L5)"
  }

  class PlanItem {
    +string recipeId
    +number weight
    +number|null cooldownDays
    +boolean enabled
    +ISODate|null lastServed
  }
  class Settings {
    +number defaultCooldown
    +number variety
    +boolean noWeekRepeat
    +boolean avoidSameTag
    +ISODate weekStart
  }
  class PlanEntry {
    +ISODate date
    +string|null recipeId
    +boolean locked
    +SelectionBreakdown|null breakdown
  }

  class Recipe {
    +string id
    +string name
    +string[] tags
    +RecipeIngredient[] ingredients
    +number servings
    +NutritionFacts nutrition
  }
  class Ingredient {
    +string id
    +string name
    +string[] tags
    +Unit defaultUnit
  }
  class NutritionFacts {
    +per-100g macros
    +per-serving macros
  }

  PlanItem --> Recipe : recipeId (meals → food kernel)
  PlanEntry --> Recipe : recipeId
  Recipe "1" --> "*" Ingredient : via RecipeIngredient
  Day --> PlanEntry : meals namespace

  note for PlanItem "meals module (§6): planning attributes"
  note for Recipe "food kernel (§7): food attributes"
```

**Key seam:** a meal's *food* attributes live in the **food kernel** (`Recipe`);
its *planning* attributes live in the **meals module** (`PlanItem`), linked by
`recipeId`. That's why macros/shopping can reuse recipes without importing meals.

## Meal engine flow (contract — 🔵 Phase 4)

The one fully-specified algorithm (design doc §6). Sketch of `generateWeek`:

```mermaid
flowchart TD
  start([generateWeek]) --> locked[Pass 1: place locked days<br/>→ working set + used set]
  locked --> loop{for each open day<br/>Mon→Sun}
  loop --> gates[Gates: enabled ·<br/>cooldown · week-repeat]
  gates --> cand{candidates<br/>left?}
  cand -- yes --> score[Scorers: fFreq · fRec · fTag<br/>→ temperature-weighted]
  score --> draw[draw: weighted random pick<br/>never argmax]
  draw --> record[record breakdown +<br/>update working set] --> loop
  cand -- no --> ladder[Degradation ladder L5:<br/>drop week-repeat → drop cooldown → null slot]
  ladder --> loop
  loop -- done --> out([WeekPlan])
```

Determinism note (L4): identical state + different `Rng` seed ⇒ different weeks;
that's the anti-clustering property the statistical tests guard (design §12).

## What's actually built today

- **Core (Phase 1)** ✅ — time (`ISODate`, date math, fixed clock), seeded RNG,
  units (convert/normalize/combine), recurrence v1 (daily/weekly/monthly,
  interval/count/until, never-throws), sparse Day record + `DayStore` with
  isolated versioned slice codecs (+ batched range reads), calendar model
  (locale week-start grids, priority intensity scale), signal registry, i18n
  service, and the six port contracts.
- **Web renderer (Phase 2)** ✅ — design tokens (system light+dark),
  month/week/day views + switcher, keyboard-first grid
  (`aria-activedescendant` roving selection), EN/CS via react-i18next,
  `localStorage` `StoragePort`, Zustand store, demo "star a day" slice
  exercising the full Day pipeline. 51 tests.
- **Tauri shell** 🔨 — compiles with icons; native (SQLite) `StoragePort`
  pending.
- The **food kernel and meals engine** classes above remain 🔵 (Phases 3–4).

Phase-by-phase narrative: [BUILD_JOURNAL.md](BUILD_JOURNAL.md) · sequence:
[ROADMAP.md](ROADMAP.md).
