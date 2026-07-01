import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from './index.js';

describe('@almanac/core scaffold', () => {
  it('exposes a version', () => {
    expect(CORE_VERSION).toBe('0.0.0');
  });
});
