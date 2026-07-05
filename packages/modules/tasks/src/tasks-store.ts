import type { Clock, StoragePort } from '@almanac/core';
import type { TaskItem } from './types.js';
import { TASKS_SCHEMA_VERSION, decodeTaskItem } from './codec.js';

const ITEM_PREFIX = 'tasks:item:';

/**
 * Envelope per entity record; deletion writes a **tombstone** (D6):
 * `{v, d: null, m, del: true}` — an ordinary LWW write, so a stale device can
 * never resurrect a deleted item at sync time (P10). Readers treat tombstones
 * as absent; a later `save` under the same id revives it (an edit, not a
 * resurrection).
 */
interface Envelope {
  v: number;
  d: unknown;
  m?: number;
  del?: boolean;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

/**
 * The tasks entity store — the first persister of real calendar events, so
 * D6/D7 apply from its first write. Reads never throw: missing, corrupt,
 * unknown-version, or tombstoned records read as absent, in isolation (L5).
 */
export interface TasksStore {
  get(id: string): Promise<TaskItem | null>;
  list(): Promise<TaskItem[]>;
  save(item: TaskItem): Promise<void>;
  /** Soft delete: writes the D6 tombstone. Unknown ids are a quiet no-op. */
  remove(id: string): Promise<void>;
}

export function createTasksStore(storage: StoragePort, clock?: Clock): TasksStore {
  function stamp(): Pick<Envelope, 'm'> {
    return clock !== undefined ? { m: clock.now() } : {};
  }

  function decodeRaw(raw: string | null): TaskItem | null {
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isEnvelope(parsed) || parsed.v !== TASKS_SCHEMA_VERSION) return null;
      if (parsed.del === true) return null; // tombstone reads as absent (D6)
      return decodeTaskItem(parsed.d);
    } catch {
      return null;
    }
  }

  return {
    get: async (id) => {
      try {
        return decodeRaw(await storage.read(ITEM_PREFIX + id));
      } catch {
        return null;
      }
    },

    list: async () => {
      let keys: string[];
      try {
        keys = await storage.keys(ITEM_PREFIX);
      } catch {
        return [];
      }
      let raws: (string | null)[];
      try {
        raws =
          storage.readMany !== undefined
            ? await storage.readMany(keys)
            : await Promise.all(keys.map((key) => storage.read(key)));
      } catch {
        return [];
      }
      return raws
        .map(decodeRaw)
        .filter((item): item is TaskItem => item !== null);
    },

    save: async (item) => {
      const envelope: Envelope = { v: TASKS_SCHEMA_VERSION, d: item, ...stamp() };
      await storage.write(ITEM_PREFIX + item.id, JSON.stringify(envelope));
    },

    remove: async (id) => {
      const tombstone: Envelope = { v: TASKS_SCHEMA_VERSION, d: null, del: true, ...stamp() };
      await storage.write(ITEM_PREFIX + id, JSON.stringify(tombstone));
    },
  };
}
