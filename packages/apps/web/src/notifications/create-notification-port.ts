import type { NotificationPayload, NotificationPort } from '@almanac/core';
import { createTimerNotificationPort } from './timer-notification-port';
import { systemClock } from '../clock';

const isTauri = (): boolean => '__TAURI_INTERNALS__' in globalThis;

async function tauriDeliver(payload: NotificationPayload): Promise<void> {
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({ title: payload.title, ...(payload.body !== undefined && { body: payload.body }) });
  } catch {
    // Plugin missing → quiet; in-app due indicators remain (L5).
  }
}

async function tauriPermission(): Promise<boolean> {
  try {
    const plugin = await import('@tauri-apps/plugin-notification');
    if (await plugin.isPermissionGranted()) return true;
    return (await plugin.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

function webDeliver(payload: NotificationPayload): void {
  try {
    new Notification(payload.title, payload.body !== undefined ? { body: payload.body } : {});
  } catch {
    // Unsupported/blocked → quiet (L5).
  }
}

async function webPermission(): Promise<boolean> {
  if (!('Notification' in globalThis)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false; // asked once, never nags
  return (await Notification.requestPermission()) === 'granted';
}

/** The environment's notification port: Tauri plugin in the shell, Web Notifications in the browser. */
export const notificationPort: NotificationPort = createTimerNotificationPort(
  isTauri()
    ? { deliver: tauriDeliver, permission: tauriPermission, clock: systemClock }
    : { deliver: webDeliver, permission: webPermission, clock: systemClock },
);
