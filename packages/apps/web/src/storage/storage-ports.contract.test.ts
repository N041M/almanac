import { beforeEach } from 'vitest';
import { createMemoryStorage } from '@almanac/core';
import { createLocalStoragePort } from './local-storage-port';
import { createSqliteStoragePort } from './sqlite-storage-port';
import { fakeDb } from './sqlite-fake';
import { describeStoragePortContract } from './storage-port-contract';

// Every on-device adapter passes the same contract (5.5). The Expo adapter
// (P11) joins this list the day it exists.

beforeEach(() => {
  globalThis.localStorage.clear();
});

describeStoragePortContract('memory', () => createMemoryStorage());
describeStoragePortContract('localStorage', () => createLocalStoragePort());
describeStoragePortContract('sqlite', () => createSqliteStoragePort(fakeDb().db));
