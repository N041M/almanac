import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationPayload } from '@almanac/core';
import { createTimerNotificationPort } from './timer-notification-port';

/**
 * The `NotificationPort` contract suite (P6 rule: a port gets its suite with
 * its first implementation). Runs against the shared timer port that both the
 * Tauri and Web adapters are built from; Expo's adapter (P11) inherits it.
 */
function make(permission = true) {
  const fired: NotificationPayload[] = [];
  const port = createTimerNotificationPort({
    deliver: (payload) => {
      fired.push(payload);
    },
    permission: () => Promise.resolve(permission),
    clock: { now: () => Date.now() },
  });
  return { port, fired };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('NotificationPort contract: timer port', () => {
  it('fires the payload at the scheduled instant, not before', async () => {
    const { port, fired } = make();
    await port.schedule('a', Date.now() + 60_000, { title: 'Dentist' });
    vi.advanceTimersByTime(59_000);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(2_000);
    expect(fired).toEqual([{ title: 'Dentist' }]);
  });

  it('re-scheduling an id replaces it — idempotent per id (5.3)', async () => {
    const { port, fired } = make();
    await port.schedule('a', Date.now() + 10_000, { title: 'old' });
    await port.schedule('a', Date.now() + 20_000, { title: 'new' });
    vi.advanceTimersByTime(30_000);
    expect(fired).toEqual([{ title: 'new' }]);
  });

  it('cancel prevents delivery; cancelling an unknown id is a no-op (5.3)', async () => {
    const { port, fired } = make();
    await port.schedule('a', Date.now() + 10_000, { title: 'x' });
    await port.cancel('a');
    await port.cancel('never-existed');
    vi.advanceTimersByTime(60_000);
    expect(fired).toEqual([]);
  });

  it('a past instant delivers immediately rather than never (L5)', async () => {
    const { port, fired } = make();
    await port.schedule('late', Date.now() - 5_000, { title: 'overdue' });
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([{ title: 'overdue' }]);
  });

  it('an absurdly far instant is quietly skipped (setTimeout overflow guard)', async () => {
    const { port, fired } = make();
    await port.schedule('far', Date.now() + 2 ** 40, { title: 'someday' });
    vi.advanceTimersByTime(2 ** 31);
    expect(fired).toEqual([]); // waits for a later app-open to reschedule
  });

  it('requestPermission resolves a boolean and denial is a normal state', async () => {
    expect(await make(true).port.requestPermission()).toBe(true);
    const denied = make(false);
    expect(await denied.port.requestPermission()).toBe(false);
    // scheduling with permission denied still never throws
    await denied.port.schedule('a', Date.now() + 1_000, { title: 'quiet' });
  });
});
