# Changelog

All notable changes to Almanac. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project uses
[conventional commits](https://www.conventionalcommits.org/) and is pre-1.0
(anything may change).

Entries are grouped by **build phase** (design doc §13) until v1.

## [Unreleased]

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
- Docs: README (the laws + dependency diagram), agent context, docs/DECISIONS.md.

### Not yet built
Phase 1 (core: day record, calendar model, recurrence, units, registry, i18n
service, full ports) onward. Apps are stubs — no Electron/Vite/React wiring yet.
