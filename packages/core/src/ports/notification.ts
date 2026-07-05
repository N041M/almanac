/**
 * System-notification seam (roadmap 5.3). Reminder *rules* (offset before an
 * event, task due, habit nudge) live in the owning modules; the core contract
 * only fires. Adapters per client: Tauri notification plugin (desktop), Web
 * Notifications (web port, best-effort), Expo (mobile, later).
 *
 * Degradation (L5): permission denied or platform unsupported ⇒ the app shows
 * quiet in-app badges instead — callers treat a `false` permission as that
 * normal state, ask once, and never nag.
 */
export interface NotificationPayload {
  /** Already i18n-resolved by the scheduling module (L7). */
  title: string;
  body?: string;
}

export interface NotificationPort {
  /** Idempotent per `id`: re-scheduling the same id replaces the pending one. */
  schedule(id: string, atUtc: number, payload: NotificationPayload): Promise<void>;
  /** Unknown ids are a no-op, never an error. */
  cancel(id: string): Promise<void>;
  /** True when notifications may fire. Ask once; `false` is a normal state. */
  requestPermission(): Promise<boolean>;
}
