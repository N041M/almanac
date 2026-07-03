# Almanac

A **personal calendar** with an offline-capable local store and (eventually)
cross-device sync. The calendar is the core; every feature is an independent
**module** that plugs into a shared hub and never depends on another module.
Multilingual from day one. Meal-planning is the first module.

## Quickstart

```sh
pnpm install
pnpm check        # typecheck + lint + test
```

Individually: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Stack

pnpm workspaces · TypeScript (strict) · React + Vite · **Tauri** desktop app
(system webview — lightweight) + a **web port** sharing the renderer · Vitest ·
ESLint `boundaries` · i18next (EN + CS) · Open Food Facts · Open-Meteo.

## Docs

- **[docs/ROADMAP.md](docs/ROADMAP.md)** — the authoritative 12-phase build
  sequence, incl. the L5 degradation matrix for every planned feature.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the laws, the dependency star, and UML diagrams.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — decision log (D0–D5).
- **[docs/BUILD_JOURNAL.md](docs/BUILD_JOURNAL.md)** — per-phase narrative.
- **[CHANGELOG.md](CHANGELOG.md)** — what shipped, per phase.
- **[ALMANAC_DESIGN_DOC.md](ALMANAC_DESIGN_DOC.md)** — the full handoff spec.

## License

[MIT](LICENSE) © 2026 Ronald Karel Grant.

## Status

**Phase 2 (calendar shell) nearly complete** — month / week / day views with a
view switcher, design tokens with system light+dark, keyboard-first grid
(roving `aria-activedescendant` selection), EN/CS i18n, `localStorage`
persistence through the versioned day-store; Tauri v2 shell compiles (icons
in; native `StoragePort` still to come). Phases 0–1 (scaffold, core) complete.
51 tests. Build sequence: [docs/ROADMAP.md](docs/ROADMAP.md).

## The one-line why

Star-modularity (modules depend on the core, never each other) + composition
over inheritance keeps every feature independently buildable, testable, and
removable — and there's no base class to override, so none to break. Full laws
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#the-laws).
