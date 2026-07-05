import { storagePort } from './persistence';
import { systemClock } from '../clock';

/**
 * The shared persistence under small entity lists (calendars, to-do lists):
 * a versioned envelope holding an array, with a guaranteed default entity as
 * the degradation floor — a corrupt slice reads as "just the default", in
 * isolation (L5). The stores own their APIs; this owns the storage shape.
 */
export interface PersistedListConfig<T extends { id: string }> {
  key: string;
  version: number;
  /** Always present; deletion-proof; what unknown ids degrade to. */
  defaultEntity: T;
  /** Entity-level validation; malformed entries are skipped (L5). */
  isEntity: (value: unknown) => value is T;
}

export function createPersistedList<T extends { id: string }>(config: PersistedListConfig<T>) {
  const withDefault = (list: T[]): T[] =>
    list.some((entity) => entity.id === config.defaultEntity.id)
      ? list
      : [config.defaultEntity, ...list];

  return {
    withDefault,

    decode(raw: string | null): T[] {
      if (raw === null) return withDefault([]);
      try {
        const parsed: unknown = JSON.parse(raw);
        const envelope = parsed as { v?: number; d?: unknown };
        if (envelope.v !== config.version || !Array.isArray(envelope.d)) return withDefault([]);
        return withDefault(envelope.d.filter(config.isEntity));
      } catch {
        return withDefault([]); // corrupt slice → the default floor (L5)
      }
    },

    async read(): Promise<T[]> {
      try {
        return this.decode(await storagePort.read(config.key));
      } catch {
        return withDefault([]);
      }
    },

    async write(list: T[]): Promise<void> {
      try {
        await storagePort.write(
          config.key,
          JSON.stringify({ v: config.version, d: list, m: systemClock.now() }),
        );
      } catch {
        // Session-only state is still state (L5).
      }
    },
  };
}
