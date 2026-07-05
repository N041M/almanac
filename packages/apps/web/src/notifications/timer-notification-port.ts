import type { Clock, NotificationPayload, NotificationPort } from '@almanac/core';

// setTimeout overflows past ~24.8 days and would fire immediately; reminders
// beyond it simply wait for a later app-open to reschedule (L5).
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export interface TimerPortDeps {
  /** Actually shows the notification (Tauri plugin, Web Notification, …). */
  deliver: (payload: NotificationPayload) => void | Promise<void>;
  /** Platform permission check/request; resolves false on any failure. */
  permission: () => Promise<boolean>;
  clock: Clock;
}

/**
 * The one `NotificationPort` implementation both clients share: in-process
 * timers + an injected `deliver`. Desktop/web can only fire while the app is
 * open — reminders resync on every load, and the 5.3 contract's degradations
 * hold: idempotent per id, unknown-id cancel is a no-op, a denied permission
 * or missing platform is a normal state that never throws.
 */
export function createTimerNotificationPort(deps: TimerPortDeps): NotificationPort {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    schedule: (id, atUtc, payload) => {
      const existing = timers.get(id);
      if (existing !== undefined) clearTimeout(existing); // re-schedule replaces
      const delay = atUtc - deps.clock.now();
      if (!Number.isFinite(delay) || delay > MAX_TIMEOUT_MS) return Promise.resolve();
      timers.set(
        id,
        setTimeout(
          () => {
            timers.delete(id);
            try {
              void deps.deliver(payload);
            } catch {
              // Delivery failure is quiet — in-app surfaces still show due state.
            }
          },
          Math.max(0, delay),
        ),
      );
      return Promise.resolve();
    },

    cancel: (id) => {
      const timer = timers.get(id);
      if (timer !== undefined) clearTimeout(timer);
      timers.delete(id);
      return Promise.resolve();
    },

    requestPermission: () => deps.permission().catch(() => false),
  };
}
