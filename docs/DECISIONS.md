# Decisions

Lightweight decision log — the forks the design doc left open (or that we chose
to depart on), with rationale. Newest first. Keep entries short.

---

## D3 — Desktop client is Electron (not Tauri)

**Decided:** 2026-07-01 · **Status:** accepted · **Design ref:** §3

The desktop shell is **Electron**, wrapping the shared Vite + React renderer;
the same renderer ships as the **web port**. Core/kernels/module logic stay
platform-agnostic (L3), so the shell is just a host. Electron chosen over Tauri
per user preference (maturity/ecosystem over footprint).

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
