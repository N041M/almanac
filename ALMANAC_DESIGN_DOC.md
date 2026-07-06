# Design doc: **Almanac** — a personal calendar (offline-capable, server-durable)

*Living spec. `Almanac` is a working codename — swap freely. Read the whole document before writing any code. Originally a handoff spec; now maintained alongside the build — resolved decisions live in [docs/DECISIONS.md](docs/DECISIONS.md) (D0–D5) and the authoritative phase sequence in [docs/ROADMAP.md](docs/ROADMAP.md). Sections below have been updated to match; §2 (laws), §6 (meal engine), and §7 (food kernel) remain the original exact contracts.*

---

## 0. How to work on this

- Read this end to end. The stack (§3) and the sync model (§11) are **confirmed** (decisions D1–D4).
- Build in the phases in **[docs/ROADMAP.md](docs/ROADMAP.md)** (supersedes §13's ordering). After each phase run typecheck + lint + tests and **stop for review**.
- **§2 (the laws) and §6 (the meal engine) are contracts, not suggestions.** The laws are invariants to preserve and, wherever possible, *enforce mechanically* (lint, package boundaries, tests). The engine is the one fully-specified algorithm and must be implemented exactly.
- Ask before deviating from §2 or the architecture in §4. If you see a genuinely better approach, say so with reasoning and wait.
- Small, conventional-commit steps. Each commit reviewable.

---

## 1. What we're building (one paragraph)

A **personal calendar and life-management app**. The calendar is the core; the central abstraction is that **a day is one composite record** that every feature reads from and writes to. Features (meal planning, macros, shopping, cycle tracking, to-dos, habits, workouts, weather, insights, …) are independent **modules that plug into a shared core** — they never depend on each other. Every client keeps an **offline-capable local store**; opt-in sync makes the **server copy durable** across devices (D4), and multi-user features (shared calendars, invites) arrive on top of it (D5). It ships **multilingual from day one** (English default) with **a Tauri desktop app + a web port sharing one framework-agnostic core** (D2/D3); a native mobile client reuses the same core in a later phase.

---

## 2. The laws (non-negotiable; enforce where possible)

**L1 — Star modularity.** Every module depends on the **core** (and shared **kernels**, §7) and on **nothing else**. **No module imports another module.** If two modules need the same thing, that thing moves *down* into the core or a kernel — never sideways. Cross-module effects happen only through two core-owned seams:
- **Shared data** on the core's day record (one module writes a field, another reads it; neither imports the other).
- **A registry** the core owns: modules register *context-signal providers* and the core mediates. (e.g. the meal engine consumes an abstract "weather signal"; it never imports the weather module.)

This is enforced, not aspirational: each module is its own package, sibling modules are **not** listed as dependencies, and an ESLint boundary rule makes a sibling import a build error (§4).

**L2 — Composition over inheritance.** No class hierarchies or base classes anywhere in domain/engine/modules. Rules, scorers, and providers are plain functions or registered objects. There is no base class to override, therefore none to break.

**L3 — Pure, framework-agnostic core.** The core and all module *logic* are plain TypeScript with **zero runtime dependencies on UI frameworks**. Logic is separate from views so both clients reuse it. Dependency direction points inward (apps → modules → kernels → core; never the reverse).

**L4 — Determinism by injection.** All randomness goes through an injected `Rng` port; all "now" through an injected `Clock` port. **No `Math.random()` or `Date.now()` in core or module logic.** Makes everything reproducible and testable.

**L5 — Graceful degradation, everywhere.** A **core concept for the whole system**, not a privacy add-on. **Every component must have a defined, working, lower-capability state for any input, dependency, signal, module, or capability that is missing, partial, declined, or erroring** — and it degrades **quietly** (never nags, never blanks the screen). Failures are **isolated, never cascading**: one bad field, adapter, module, or storage slice degrades only itself. The meal engine's relaxation ladder (§6.5) is the canonical example, and the privacy/permission fallbacks are simply one instance. Everything optional is **additive** — nothing in the core breaks when it's absent. The full set of categories and their acceptance criteria are in §9.

**L6 — Locally-cached, server-durable** *(relaxed from strict local-first by D4)*. Every client keeps an on-device store behind `StoragePort` — instant UI, fully offline-capable. Opt-in sync (§11) makes the **server copy the durable one**: per-slice last-writer-wins by revision; the web port may read through the server when its cache is cold. No third-party analytics, no tracking. Outbound network calls (nutrition lookup, weather, sync, and the P8/P12 interop features) each sit behind a port and each degrades per L5.

**L7 — Internationalization from day one.** **No hardcoded user-facing strings** — everything is a key resolved at render time. The i18n service lives in the core; **each module ships its own translation namespace** alongside its code; locale bundles load lazily; a missing key falls back to **English** (the default and the one guaranteed-complete locale). "Locale" means **text + formatting + region** (Intl-based dates/numbers, week-start day, metric/imperial, decimal separator), not just a language code. Details in §10.

**L8 — Strict TypeScript.** `strict: true`, `noUncheckedIndexedAccess: true`, no `any`, no non-null assertions used to dodge types.

---

## 3. Tech stack (use this unless you flag a better fit first)

- **Monorepo:** pnpm workspaces. Package boundaries are what make L1/L3 enforceable.
- **Language:** TypeScript (strict).
- **Core + kernels + module logic:** plain TS, zero UI-framework deps. If schema validation is wanted (zod), isolate it in a schema/adapter sub-module — keep the engine itself dependency-free.
- **Desktop client:** **Tauri v2** (D3 — chosen over Electron for its system-webview memory footprint) wrapping the shared renderer.
- **Web client (the shared renderer):** React + **Vite** + **Tailwind v4** + **Zustand** + **Vitest** + React Testing Library. The same build is the web port and the Tauri frontend (D2).
- **Mobile client (later phase, ROADMAP P11):** **React Native (Expo)**, sharing the same core + kernels + module logic. Views are per-client (see §4); optional React-Native-Web component sharing is allowed but **never** at the cost of L1.
- **i18n:** `i18next` + `react-i18next` (works across both clients; supports per-namespace lazy loading, interpolation, pluralization, and English fallback).
- **Boundary enforcement:** ESLint with `eslint-plugin-boundaries` (or `dependency-cruiser`) implementing the matrix in §4.
- **External data:** Open Food Facts (nutrition) and Open-Meteo (weather), each behind a port/adapter.
- **Barcode:** native scanner module in the mobile app (no iOS web-scanning gap); desktop uses name search (§8 shopping/macros).

Not Next.js: this is an offline-capable SPA + native shells, not an SSR site.

---

## 4. Architecture & repo layout

Dependency rule (arrows point inward; the lint rule enforces it):

```
apps  ──────────►  modules  ─────►  kernels  ─────►  core
(desktop, web,      (spokes)        (food, …)        (day, calendar, ports, registry, i18n)
 mobile later)
```

```
packages/
  core/                      # pure, zero-dep. The hub. Knows about no module.
    src/
      day/                   #   Day composite record + day-store contract
      calendar/              #   month/week/day model (the lens)
      schedule/              #   recurrence primitives (RRULE-style) shared by todos/habits/events/shopping
      units/                 #   quantities, units, conversion/normalization
      registry/              #   context-signal registry (providers register; consumers read abstractly)
      i18n/                  #   i18n service + locale model (text + formatting + region)
      ports/                 #   Rng, Clock, StoragePort, WeatherPort, NutritionPort
      index.ts
  kernels/
    food/                    # shared substrate for meals/macros/shopping/pantry. Depends on core only.
      src/                   #   Ingredient, Recipe, NutritionFacts, product catalog + OFF lookup adapter
  modules/                   # each is an independent package; logic only (no views)
    meals/                   #   the selection engine (§6): weights, cooldowns, plan generation
    macros/                  #   targets + intake logging/calculation
    shopping/                #   two-trigger aggregation engine (§8)
    pantry/                  #   inventory (decoupled extension of shopping)
    tasks/                   #   to-dos + events + habits (primitives, §8)
    checkin/                 #   daily mood/energy/symptom log
    cycle/                   #   menstrual cycle logging + on-device prediction
    body/                    #   weight & body-metric trend
    workouts/                #   training log + (optional) plan generation
    weather/                 #   ambient weather; registers a signal provider; Open-Meteo adapter
    insights/               #   cross-day analytics (reads shared day data; imports no module)
  apps/
    desktop/                 # Tauri v2 shell (primary client; system webview) over the web build.
    web/                     # React + Vite — the shared renderer + the web port.
    mobile/                  # (later, ROADMAP P11) React Native (Expo) + native barcode scanner.
README.md
```

**Boundary matrix (encode this in the lint config):**

| Element | May import |
|---|---|
| `core` | nothing (only the ports it defines) |
| `kernels/*` | `core` |
| `modules/*` | `core`, `kernels/*` — **never another module** |
| `apps/*` | `core`, `kernels/*`, `modules/*` (everything) |

Two enforcement layers: (1) package.json dependencies — a module simply does not list sibling modules; (2) the ESLint rule — catches relative/deep imports that try to bypass package boundaries. A sibling import is a **failed build**, not a code-review note.

**How a module plugs into the core.** A module exports a manifest the host app registers. The manifest may provide: a **day-cell contribution** (what this module draws on a calendar day — rendered by the client), **detail screens** (per-client views), **context-signal providers** (e.g. weather → a "conditions" signal), an **i18n namespace**, and a **storage schema slice** (its slice of the local store). Each entry also declares its **degraded behaviour** — what the module does when a signal, dependency, or its own data is absent or erroring (L5). The core/host wires these; modules never reach into each other.

---

## 5. The day record & core services

**The Day** is the composite the whole app orbits. It is a plain record keyed by date that holds each module's contributions as namespaced fields (e.g. `meals.recipeId`, `macros.intake`, `cycle.log`, `tasks[]`, `weather.snapshot`). Modules read/write only their own namespace plus explicitly shared fields, and **every reader treats an absent field as a normal, handled state** (L5). The calendar (month/week/day) is just the lens over Days.

Core services every module can rely on:
- **Calendar model** — month/week/day views; week-start is locale-driven (§10). Day-cell contributions may carry an optional **priority (1–3)**, and the calendar owns the single intensity scale that renders it — **P1 fully solid, P2 ~30 % faded, P3 ~60 % faded** — so priority reads consistently across every module (absent priority → full intensity, L5).
- **Schedule/recurrence** — one RRULE-style primitive powering to-dos, events, habits, recurring shopping days, and recurring meal-prep tasks. (Nobody re-implements recurrence.)
- **Units** — quantity/unit types + normalization/conversion (used by food kernel, shopping, body, workouts).
- **Registry** — context-signal provider/consumer mediation (the L1 seam for behaviour). Consumers must define behaviour for when **no provider is registered** (L5).
- **i18n** — key resolution, lazy bundle loading, English fallback, Intl formatting.
- **Ports** — `Rng`, `Clock`, `StoragePort`, `WeatherPort`, `NutritionPort` (adapters live in kernels/apps).

---

## 6. Meal-planning module (the engine contract — implement exactly)

> Note for the full app: a meal's **food attributes** (name, tags, ingredients, servings, nutrition) live in the **food kernel** as a `Recipe`; its **planning attributes** (weight, cooldown, enabled, lastServed) live in this module, linked by `recipeId`. The engine reads `tags` from the linked recipe. The algorithm below is otherwise unchanged.

### 6.1 Data model

```ts
type ISODate = string; // "YYYY-MM-DD"

interface PlanItem {            // meals module owns this; references a kernel Recipe
  recipeId: string;
  weight: number;              // frequency multiplier; presets 0.4 / 1 / 2 / 3.5
  cooldownDays: number | null; // null => use Settings.defaultCooldown
  enabled: boolean;
  lastServed: ISODate | null;  // committed history only (see 6.5)
}

interface Settings {
  defaultCooldown: number;     // days
  variety: number;             // 0..1 slider
  noWeekRepeat: boolean;
  avoidSameTag: boolean;
  weekStart: ISODate;          // locale-driven week start
}

interface SelectionBreakdown {
  prob: number; candidateCount: number;
  fFreq: number; fRec: number; fTag: number;
  daysSince: number | null;    // null => never served
  alternatives: { id: string; name: string; p: number }[];
}

interface PlanEntry { dayName: string; date: ISODate; recipeId: string | null; locked: boolean; breakdown: SelectionBreakdown | null; }
type WeekPlan = PlanEntry[];    // length 7, Monday..Sunday
```

### 6.2 Constants (export; don't inline)

```
RECENCY_TAU   = 5.5     // days; recovery rate after a meal appears
TAG_PENALTY   = 0.35    // multiplier when cuisine matches the previous day
JITTER        = rng => 0.9 + 0.2 * rng()
WEIGHT_PRESETS = [{Rare:0.4},{Normal:1},{Often:2},{Favourite:3.5}]
```

### 6.3 Gates (hard exclusion)

For a candidate at `slotDate`, with `working: Map<recipeId, ISODate>` = last date served/placed:
- **enabled** — exclude if `!enabled`.
- **cooldown** — `d = |diffDays(working[id], slotDate)|`; exclude if a working date exists and `d < (cooldownDays ?? defaultCooldown)`.
- **week-repeat** — if `noWeekRepeat`, exclude if already used this week.

### 6.4 Scorers (soft, multiplicative — shape probability, not eligibility)

```
recencyFactor(d) = d === Infinity ? 1 : 1 - exp(-|d| / RECENCY_TAU)   // never-served => 1
fFreq = weight
fRec  = recencyFactor(daysSince)
fTag  = (avoidSameTag && recipe.tags ∩ previousDayTags ≠ ∅) ? TAG_PENALTY : 1

score  = max(fFreq * fRec * fTag, 1e-6)
weight = score ^ (1 / temperature) * JITTER(rng)
temperature = 0.45 + variety * 2.2
// variety 0 → sharpen toward least-recently-used (rotation-like)
// variety 1 → flatten (surprising); 0.5 = the sweet spot
```

### 6.5 Selection

- **`draw(candidates, rng, excludeId?)`** — weighted random pick (roulette) **proportional to weight**, never `argmax`. Returns the pick + full probability distribution (for the breakdown + alternatives). `excludeId` drops the current pick on re-roll unless it's the only option.
- **`generateWeek(items, settings, prevPlan, rng)`** — history = `lastServed` only (the visible plan is **not** folded back in, so re-generating never penalises itself). Pass 1: place locked days, add to `working` + used-set. Pass 2: fill remaining days Mon→Sun, building candidates (gates→scorers), drawing, updating `working`, recording the breakdown; `previousDayTags` from the prior day. **Degradation ladder** (never throws): no candidates → drop week-repeat → drop cooldown → leave `recipeId: null`.
- **`rerollDay(items, settings, plan, index, rng)`** — re-pick one slot using the other six days + history; exclude current when possible; same ladder.
- **`commitWeek(items, plan)`** — set each used recipe's `lastServed` to its latest date in the plan; advance `weekStart` by 7. The only writer of history.

### 6.6 The principle to encode and comment

> Clustering and predictability are two different problems. A *soft* recency penalty makes recent meals unlikely (not forbidden); a *probabilistic* draw means identical state still yields different weeks. Greedy/argmax is the failure mode — it produces a fixed rotation. The variety slider is the sampling temperature.

UX: 7-day grid that respects locked days; per-day re-roll and lock; variety slider; week navigation (Next week commits + advances); and a **"why this pick"** breakdown showing the factor values, the selection probability, and bars for the chosen meal vs top alternatives (the signature element).

---

## 7. The food kernel

Shared substrate for **meals, macros, shopping, pantry** — so none of those modules depend on each other. Depends on `core` only.

- **`Ingredient`** — name, tags (e.g. aisle/category), optional default unit.
- **`Quantity` / units** — via core's units service; supports normalization (e.g. reconciling "2 onions" + "200 g onion", or keeping them separate when units don't combine).
- **`NutritionFacts`** — per-100g and per-serving macros (and room for more later).
- **`Recipe`** — name, tags, `ingredients: {ingredientId, quantity, unit}[]`, servings, derived nutrition. (The planning module references these by id.)
- **Product catalog + `NutritionPort` adapter (Open Food Facts).** READ requires only a descriptive **User-Agent** (no key); barcode endpoint `GET /api/v2/product/{barcode}`. Data is **ODbL — attribution + share-alike** (share-alike only matters if you merge it into a redistributed dataset; for a personal app it's a non-issue). It's crowd-sourced, so **check each field is present**, **cache every lookup locally**, and respect the rate limit (~15 product reads/min per IP, per-user from mobile; seed from the bulk export if heavy). **Degradation (L5):** offline/declined → manual entry (ingredient + your own quantity, nutrition blank). Lookup is enrichment, never a gate.

---

## 8. The other modules (concise specs — each depends on core/kernels only)

Each: purpose · key data · dependencies · degradation · phase.

- **Macros** — daily intake calc + targets (manual, or derived from a goal). Logs from **planned meals** (auto-fills from the day's recipe via the kernel), manual entry, or barcode scan. Deps: core, food kernel. Degrade: scan unavailable → manual; targets always editable. *v1.*
- **Shopping** *(spec'd below, §8.1)* — two-trigger list generator. Deps: core (the plan + recurrence), food kernel (ingredients/units). **Does not import the meals module.** Degrade: fully offline (derived from local data); only category/nutrition enrichment is network. *v1.*
- **Pantry/inventory** — tracks what you have on hand. **Decoupled extension:** writes stock to a shared place; the shopping engine reads "needed − on-hand" through the core. No coupling between the two. *Later.*
- **Tasks (to-dos · events · habits)** — three distinct primitives that must not blur: a **task** is discrete/done-once with optional due date+time; an **event** is time-blocked; a **habit** is recurring and tracked over time (streaks). Recurrence comes from core's schedule primitive. The module adds:
    - **Priority (1–3)** per item, surfaced on the calendar through the shared intensity scale (§5): P1 solid → P3 faded.
    - **User-definable categories** (e.g. *work*, *personal*, *errands*), each independently **toggleable** — switch one off and its items disappear from the calendar and lists (a visibility filter in the module's state, never deletion).
    - A **location / context** axis (`@home`, `@work`, `@store`) — the "location-divided tasks" dimension; also toggleable. Surfacing, say, `@store` items next to the shopping list is composed in the **client view** (which sees all namespaces), not by importing another module (L1).
    - **Keyboard-first quick entry.** A parser — module logic, framework-agnostic and tested; the input widget is per-client — reads inline sigils in the add field: `#category`, `@location`, and `!1`/`!2`/`!3` for priority. Plus a command palette to filter/toggle categories from the keyboard. *(Proposed grammar — confirm the sigils.)*
    - **Bullet / checklist lists** — lightweight nested checklists for items that don't warrant full task objects, rendered as plain bulleted to-dos.
  Deps: core. Categories, locations, and priority are tasks-module state; the calendar only reads the priority and visibility the module exposes. *v1: tasks/events + priority + categories; habits + command palette soon after.*
- **Daily check-in** — one quick log: mood, energy, symptoms. Feeds cycle and insights as **shared day data**, not via imports. Deps: core. *Later.*
- **Cycle tracking** — period start/end + flow, symptoms (via check-in's shared fields or its own), cycle-length stats, **on-device phase prediction**. Deps: core. Privacy: local-only by default; predictions are personal estimates, informational only. Degrade: disable prediction → still logs + shows history. *Later.*
- **Body & weight trend** — weight + optional measurements, trend chart. Body composition is a **user-entered input** (optionally from a smart scale later), not measured by the app; it mainly feeds macro targets. Deps: core, units. *Later.*
- **Workouts/training** — session log on the calendar; optional plan generation reusing the meal-engine *pattern* (exercise library tagged by movement/muscle/equipment + program templates by goal/experience/frequency + a composable assembler + progression rules). Program is driven by goal/experience/equipment/frequency; body comp is a minor input. Frame generated plans as adjustable scaffolds, not medical/PT advice. Deps: core, units. *Later.*
- **Weather** — ambient context attached to the day; **registers a context-signal provider** the meal engine and workout/task scheduling can consume abstractly (the engine never imports weather). `WeatherPort` adapter = **Open-Meteo** (no key, no signup for non-commercial; **CC BY 4.0 attribution**; ~10k calls/day; 16-day forecast; geocoding endpoint for city→coords; commercial use needs a paid plan or self-host the OSS server). Degrade (L5): no location → manual city, or weather simply absent and dependent suggestions fall back to non-weather behaviour. **Cache aggressively** (weather rarely needs per-view refresh — also keeps you under the limit). Privacy: query the API with coords but keep location on-device. *Later (v1-optional).*
- **Insights** — cross-day analytics and correlations (energy vs cycle phase, weight vs macro adherence, etc.). Reads **shared day data across the date range** — it imports **no** module, which is exactly why a unified day record is worth having. Deps: core. *Last.*

### 8.1 Shopping list — one aggregation engine, two triggers

Mirrors "generate week / reroll": one function, two entry points.

- **Scheduled shopping days** — the user selects shopping days, one-off or **recurring** (e.g. every Saturday, via core's recurrence primitive). Each trip's list covers the **planned meals from that trip until the next shopping day**, so choosing the days defines the windows automatically.
- **"Shopping now"** — an **ad-hoc window**: now → your next shopping day (or a default horizon), computed on the spot.

Engine: gather the meals planned in the window (plan read from the **core** day record) → multiply each recipe's ingredients by its servings (recipes from the **food kernel**) → **aggregate by ingredient with unit normalization** (units kernel: combine compatible quantities, keep incompatible ones separate) → group by category/aisle from ingredient tags. UI: checkboxes, editable quantities, manual add. With the **pantry** module present, the list subtracts on-hand stock via the shared store — **without** the two modules importing each other.

---

## 9. Graceful degradation (a core concept)

Per **L5**, degradation is pervasive, not a privacy feature. Every category below must have a **defined, working, quiet** fallback. These are acceptance criteria (§12/§13), not prose.

- **Missing optional signals.** Any registered context-signal provider can be absent; consumers define behaviour without it (the meal engine runs perfectly with no weather signal). The registry never assumes a provider exists.
- **Missing / partial data.** The day record is sparse by nature — every reader treats an absent field as a normal state, not an error. Partial data reduces function, never crashes: no servings on a recipe → estimate or flag; no tags → the tag-variety scorer no-ops; crowd-sourced nutrition fields may simply be missing.
- **Absent modules.** Because no module depends on another (L1), any module may be uninstalled, disabled, or not-yet-built. The calendar renders days with zero module contributions; insights works with whatever modules are present; nothing else notices the gap. *The app must run with any single module removed.*
- **Constraint relaxation (engine ladders).** When constraints can't all be met, relax them in a **defined order** rather than failing — the meal engine's ladder (week-repeat → cooldown → null slot, §6.5) is the template; the workout assembler and shopping aggregation follow suit (too few exercises → relax the split; a missing quantity → list the item unpriced and flag it).
- **Storage failures.** Per-module schema slices are **isolated**: a corrupted or unknown-version slice falls back to that module's defaults (or in-memory) **without taking down other modules or the app**. A storage read error degrades to defaults, never a white screen.
- **External adapters & permissions** (the privacy instance) — each row works and degrades quietly:

| Feature | Needs | Degraded state when declined/unavailable |
|---|---|---|
| Weather | Location, network | Manual city, or weather absent; meal/workout/task suggestions fall back to their non-weather behaviour (signal simply missing) |
| Nutrition lookup | Network | Manual entry (ingredient + quantity), nutrition fields blank; never blocks logging |
| Barcode scan | Camera | Name search / manual entry |
| Cycle & health data | — | Prediction on-device; disable prediction → still logs + history; syncs like any other slice once sync is on (D4) |
| Sync (§11, adopted) | Network, account | App fully functional single-device; sync only ever *adds* cross-device convenience |

- **Localization.** A missing translation key falls back to English (L7) — the same law applied to text.
- **UI failure isolation.** A day-cell contribution or detail view that throws degrades to "that cell/section shows nothing" behind a boundary — it never breaks the calendar render.
- **Capability detection.** Detect platform capabilities (native barcode scanner on mobile, absent on desktop web) and route to a fallback (name search); never assume a capability is present.
- **Empty / first-run states.** No data yet is the most common degraded state — every surface has an **actionable empty state**, not a blank screen.

Throughline: everything optional is **additive**; nothing in the core breaks when it's absent (L5).

---

## 10. Internationalization (mechanics)

- No hardcoded user-facing strings; all keys resolved at render via the core i18n service.
- **Per-module namespaces** shipped with each module; the host loads the active locale's bundles **lazily**; **missing key → English** (default + guaranteed-complete).
- `i18next` + `react-i18next` on both clients (namespaces, lazy per-namespace loading, interpolation, pluralization, fallback).
- **Locale = text + formatting + region.** Use `Intl` for dates/numbers; region drives **week-start day** (Monday in CZ, Sunday in US), date format, decimal separator, and **metric/imperial** units (the units kernel + body/macros must honour this). These aren't cosmetic — the calendar grid and every quantity depend on them.
- Ship **English + Czech** from the start to prove the pipeline (both LTR; skip RTL for now but keep layout direction-agnostic as cheap insurance).

---

## 11. Persistence & (optional) sync

- Local store behind `StoragePort`; **schema-versioned**; each module owns its **schema slice**; migrations keyed by version. **Slices are isolated — a corrupted or unknown-version slice falls back to that module's defaults without affecting other modules or the app (L5).** Web: localStorage to start (IndexedDB later). Desktop: SQLite/filesystem adapter. Mobile: the platform store. Adapters are swappable per L3/L6.
- **Decided (D1 + D4): full opt-in sync, server-durable.** Accounts + cross-device sync; the on-device store stays (offline + instant UI) and the server copy is the durable one. Mechanics (pinned early so slice data stays sync-ready):
  - **Per-slice revision sync** — the unit of sync = the per-day, per-module slice; the server keeps an authoritative monotonic revision log; clients push changed slices (debounced, on open, on network-regain) and pull deltas since their last revision.
  - **Conflicts: last-writer-wins per slice, silently** (single-user data; slice envelopes carry a modified-at timestamp from day one).
  - **Per-client posture:** desktop/mobile hold a full local store; the web port treats local storage as a cache and reads through the server when cold.
  - Sync remains **additive** (L5): everything works single-device, fully offline; multi-user (§15/ROADMAP P12) builds on these same streams.

---

## 12. Testing — definition of correctness

- **Engine (§6):** unit-test every gate and scorer; **seeded `Rng` + fixed `Clock`** for determinism; locked-day preservation; `commitWeek` history; re-roll changes the pick when alternatives exist. Target ≥90% coverage on the engine.
- **Statistical / anti-pattern tests** (the important ones): over a long run of committed weeks — (a) empirical frequency ≈ proportional to weights; (b) min gap between repeats ≥ cooldown; (c) the sequence is **not periodic** (conditional entropy of "next given previous" > 0; two seeds from the same history differ in ≥1 slot with high probability); (d) lowering `variety` measurably increases predictability. Plus degradation-ladder tests (3 meals + no-week-repeat still fills; all-on-cooldown still fills; zero enabled → null slots, no crash).
- **Boundary lint as a test:** CI fails if any module imports a sibling (L1).
- **Degradation tests (§9), cross-cutting:** every module has tests proving a defined, quiet behaviour when its inputs, dependencies, signals, or storage slice are **absent, partial, or erroring** — including **module-absence** (the app runs with any single module removed), **storage-slice isolation** (a corrupted slice doesn't break others), the engine ladders, and the permission/network fallbacks. Failures must be isolated, never cascading.
- **i18n tests:** English namespace is complete for every module; a deliberately missing non-English key falls back to English.

---

## 13. Build phases

**Superseded by [docs/ROADMAP.md](docs/ROADMAP.md)** (D0 reordered this
section's food-centric spine to calendar-first, and the roadmap adds the
calendar-completeness features and multi-user, D5). The roadmap keeps this
section's discipline: acceptance criteria per phase, `pnpm check` green, and
**stop after each phase for review**. Summary of the current sequence:

0. Scaffold ✅ · 1. Core ✅ · 2. Calendar shell (tokens, month/week/day views,
EN+CS) ✅ · 3. Food kernel ✅ · 4. Meals module (§6 exactly — **the load-bearing
gate**, incl. the module-manifest seam) ✅ · 5. Calendar core v2 (recurrence v2,
timed/multi-day/timezone events, notifications, hour-grid/agenda views, drag &
drop, undo, settings, vault export) ✅ · 6. Tasks/events/habits (+ NL quick
entry) ✅ · 7. Macros + shopping ✅ (two modules over the food kernel; shopping's
two-trigger aggregation §8.1, macros intake-vs-targets §8; both read the plan
off the shared day record, neither imports meals) ·
8. Interop (ICS import/export via an own RFC 5545 parser, read-only feed
subscriptions behind a core FeedPort, ranked palette search, year view, print) ✅ ·
9. Life modules (check-in, cycle, body, workouts, weather, insights,
birthdays) · 10. Sync (§11) · 11. Mobile + widgets/tray · 12. Multi-user (§15).

---

## 14. Deliverables

- Working `pnpm --filter @almanac/web dev` (web port), `pnpm --filter @almanac/desktop dev` (Tauri), and — from ROADMAP P11 — an Expo run (mobile), all sharing one core.
- Green `pnpm test` / `typecheck` / `lint`, **including the boundary and i18n tests**.
- A README stating **the laws (§2)**, an ASCII dependency diagram, run instructions, and a short rationale for star-modularity + composition-over-inheritance.
- Conventional-commit history.

---

## 15. Scope edges (keep the seams clean)

**Multi-user is now in scope** (D5, reversing this section's original
exclusion): shared calendars, attendees/invitations/RSVP (incl. the
**auto-accept whitelist** for trusted senders), free-busy + find-a-time,
booking pages, and conferencing links — as ROADMAP **Phase 12**, built
strictly on top of sync's accounts + per-slice streams, additive per L5
(signed-out/offline = the full single-user app).

Still out of scope: nutrition micronutrients and AI meal/workout suggestions —
future work; don't build them, don't architect them out. Reasonable later
extensions (pantry, meal categories with slot rules like "fish on Fridays",
adaptive TDEE) must each arrive as a **new module or a new rule composed into
the core**, never as a rewrite and never as a sibling dependency. (Import/
export graduated into the plan: ROADMAP P8.)
