import { create } from 'zustand';

/**
 * The app-level undo stack (roadmap 5.4): each user action that writes day
 * slices pushes one entry whose `apply` performs the inverse writes *and* the
 * matching in-memory state updates. Best-effort session state, never a data
 * authority (L5): a failed inverse drops the entry quietly, and the stack
 * doesn't survive reload.
 */
export interface UndoEntry {
  /** i18n key (with namespace) describing what will be undone. */
  labelKey: string;
  apply: () => Promise<void>;
}

const STACK_LIMIT = 50;
const TOAST_MS = 5000;

interface UndoState {
  stack: UndoEntry[];
  /** The label of the last undoable action, shown as a toast with "Undo". */
  toastKey: string | null;
  push: (entry: UndoEntry) => void;
  undo: () => Promise<void>;
  dismissToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUndo = create<UndoState>((set, get) => ({
  stack: [],
  toastKey: null,

  push: (entry) => {
    set((s) => ({ stack: [...s.stack.slice(-(STACK_LIMIT - 1)), entry], toastKey: entry.labelKey }));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toastKey: null }), TOAST_MS);
  },

  undo: async () => {
    const { stack } = get();
    const entry = stack[stack.length - 1];
    if (entry === undefined) return; // nothing to undo: a quiet no-op
    set({ stack: stack.slice(0, -1), toastKey: null });
    try {
      await entry.apply();
    } catch {
      // Inverse failed (storage gone, state moved on) — dropped quietly (L5).
    }
  },

  dismissToast: () => {
    clearTimeout(toastTimer);
    set({ toastKey: null });
  },
}));
