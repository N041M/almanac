# Almanac

A **local-first personal calendar**. The calendar is the core; every feature is
an independent **module** that plugs into a shared hub and never depends on
another module. Runs offline, keeps sensitive data on-device, multilingual from
day one. Meal-planning is the first module.

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

- **[docs/](docs/)** — architecture + UML, decisions, and the build journal ([docs/README.md](docs/README.md) indexes them).
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the laws, the dependency star, and UML diagrams.
- **[CHANGELOG.md](CHANGELOG.md)** — what shipped, per phase.
- **[ALMANAC_DESIGN_DOC.md](ALMANAC_DESIGN_DOC.md)** — the full handoff spec.
- **[agent context](agent context)** — working context for the assistant.

## Status

**Phase 0 (scaffold) complete** — workspaces, strict TS, boundary lint, Vitest,
CI, i18n stubs; apps are stubs. Build phases: design doc §13.

## The one-line why

Star-modularity (modules depend on the core, never each other) + composition
over inheritance keeps every feature independently buildable, testable, and
removable — and there's no base class to override, so none to break. Full laws
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#the-laws).
