import type { SliceCodec } from '../day/slice-codec.js';
import type { LocaleBundles, Messages } from '../i18n/i18n.js';
import type { SignalRegistry } from '../registry/registry.js';

/**
 * What a module declares to the app shell — the L1 seam for *presence*. The
 * shell wires manifests together; modules never wire (or see) each other.
 * Everything beyond `id` is optional: a capability a module doesn't declare is
 * simply absent, and every consumer already handles absence (L5). Views are
 * deliberately not here — renderers are per-client and register client-side
 * (L3); this manifest carries only the framework-free logic surface.
 */
export interface ModuleManifest {
  /** Unique module id; doubles as its storage namespace and i18n namespace. */
  id: string;
  /** Day-slice codecs this module persists (isolated per §11). */
  codecs?: ReadonlyArray<SliceCodec<unknown>>;
  /** language → messages for this module's namespace. English required (L7). */
  messages?: Record<string, Messages>;
  /** Context signals the module provides, by signal name (§5 registry). */
  signals?: Record<string, () => unknown>;
}

export interface AppliedManifests {
  /** All modules' messages, shaped for `createI18n` (namespace = module id). */
  bundles: LocaleBundles;
  /** All modules' day-slice codecs, for day-store assembly. */
  codecs: SliceCodec<unknown>[];
}

/**
 * Fold manifests into what the shell needs, registering any provided signals.
 * Order-independent per module (L1: no module observes another's presence).
 */
export function applyManifests(
  manifests: ReadonlyArray<ModuleManifest>,
  registry?: SignalRegistry,
): AppliedManifests {
  const bundles: LocaleBundles = {};
  const codecs: SliceCodec<unknown>[] = [];
  for (const manifest of manifests) {
    for (const [language, messages] of Object.entries(manifest.messages ?? {})) {
      (bundles[language] ??= {})[manifest.id] = messages;
    }
    codecs.push(...(manifest.codecs ?? []));
    if (registry !== undefined) {
      for (const [name, provider] of Object.entries(manifest.signals ?? {})) {
        registry.register(name, provider);
      }
    }
  }
  return { bundles, codecs };
}
