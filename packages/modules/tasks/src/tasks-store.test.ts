import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '@almanac/core';
import { createTasksStore } from './tasks-store.js';
import type { Task } from './types.js';

const task: Task = {
  kind: 'task',
  id: 't1',
  title: 'Pay rent',
  categories: ['home'],
  contexts: [],
  priority: 1,
  due: { date: '2026-07-10', minutes: 540 },
  doneAt: null,
};

describe('createTasksStore (D6 tombstones)', () => {
  it('round-trips items and lists them', async () => {
    const store = createTasksStore(createMemoryStorage());
    await store.save(task);
    expect(await store.get('t1')).toEqual(task);
    expect(await store.list()).toEqual([task]);
  });

  it('remove writes a tombstone: absent to readers, an LWW write underneath', async () => {
    const storage = createMemoryStorage();
    const store = createTasksStore(storage, { now: () => 777 });
    await store.save(task);
    await store.remove('t1');

    expect(await store.get('t1')).toBeNull();
    expect(await store.list()).toEqual([]);
    // The record still exists as a stamped tombstone — that's what syncs (D6).
    const raw = JSON.parse((await storage.read('tasks:item:t1')) ?? '{}') as Record<string, unknown>;
    expect(raw).toMatchObject({ del: true, d: null, m: 777 });
  });

  it('saving again after removal revives the id (an edit, not a resurrection)', async () => {
    const store = createTasksStore(createMemoryStorage());
    await store.save(task);
    await store.remove('t1');
    await store.save({ ...task, title: 'Pay rent (again)' });
    expect((await store.get('t1'))?.title).toBe('Pay rent (again)');
  });

  it('corrupt and unknown-version records read as absent, in isolation (L5)', async () => {
    const storage = createMemoryStorage({
      'tasks:item:bad': 'not json{',
      'tasks:item:old': JSON.stringify({ v: 99, d: task }),
      'tasks:item:shapeless': JSON.stringify({ v: 1, d: { kind: 'event', id: 'x', title: 'no when' } }),
    });
    const store = createTasksStore(storage);
    await store.save(task);
    expect(await store.list()).toEqual([task]);
    expect(await store.get('bad')).toBeNull();
  });

  it('storage failures degrade to empty, never a throw (L5)', async () => {
    const broken = {
      read: () => Promise.reject(new Error('io')),
      write: () => Promise.reject(new Error('io')),
      remove: () => Promise.reject(new Error('io')),
      keys: () => Promise.reject(new Error('io')),
    };
    const store = createTasksStore(broken);
    expect(await store.get('t1')).toBeNull();
    expect(await store.list()).toEqual([]);
  });
});
