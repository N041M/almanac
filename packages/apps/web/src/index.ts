// @almanac/web — the web port of the same Vite React renderer the desktop
// (Electron) app hosts. Same core verbatim (L3). Phase 2 shares the renderer.
import { CORE_VERSION } from '@almanac/core';

export function bootInfo(): string {
  return `Almanac web (core ${CORE_VERSION})`;
}
