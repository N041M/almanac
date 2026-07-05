import { create } from 'zustand';
import { createPersistedList } from './persisted-list';

/**
 * Multiple to-do lists: a list is just a named container; a task carries
 * `listId`. The default list (Inbox) always exists — deleting a list never
 * deletes its tasks, they degrade back to Inbox (L5), same contract as
 * calendars.
 */
export interface TaskList {
  id: string;
  name: string;
}

export const DEFAULT_LIST_ID = 'inbox';

const persisted = createPersistedList<TaskList>({
  key: 'tasks:lists',
  version: 1,
  defaultEntity: { id: DEFAULT_LIST_ID, name: '' },
  isEntity: (value): value is TaskList =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TaskList).id === 'string' &&
    typeof (value as TaskList).name === 'string',
});

interface TaskListsState {
  loaded: boolean;
  lists: TaskList[];

  load: () => Promise<void>;
  add: (name: string) => Promise<void>;
  /** Tasks keep their listId and degrade to Inbox — never deleted. */
  remove: (id: string) => Promise<void>;
  /** Resolve an item's list; unknown ids read as Inbox (L5). */
  listOf: (listId: string | undefined) => TaskList;
}

export const useTaskLists = create<TaskListsState>((set, get) => {
  async function persist(lists: TaskList[]): Promise<void> {
    set({ lists });
    await persisted.write(lists);
  }

  return {
    loaded: false,
    lists: persisted.withDefault([]),

    load: async () => {
      if (get().loaded) return;
      set({ loaded: true, lists: await persisted.read() });
    },

    add: (name) => {
      const trimmed = name.trim();
      if (trimmed === '') return Promise.resolve();
      return persist([...get().lists, { id: crypto.randomUUID(), name: trimmed }]);
    },

    remove: (id) => {
      if (id === DEFAULT_LIST_ID) return Promise.resolve(); // Inbox stays
      return persist(get().lists.filter((l) => l.id !== id));
    },

    listOf: (listId) => {
      const { lists } = get();
      return (
        lists.find((l) => l.id === listId) ??
        lists.find((l) => l.id === DEFAULT_LIST_ID) ?? { id: DEFAULT_LIST_ID, name: '' }
      );
    },
  };
});
