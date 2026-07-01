// @almanac/desktop — Electron shell (primary client). Phase 2 wires the
// Electron main/preload + Vite React renderer and the calendar shell UI.
// Apps are the top layer: they may import core, kernels, and modules (§4).
import { CORE_VERSION } from '@almanac/core';

export function bootInfo(): string {
  return `Almanac desktop (core ${CORE_VERSION})`;
}
