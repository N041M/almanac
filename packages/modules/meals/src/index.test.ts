import { describe, it, expect } from 'vitest';
import { MEALS_MODULE_VERSION } from './index.js';
// Importing from core (a hub) and the food kernel is allowed by the §4 matrix.
import { CORE_VERSION } from '@almanac/core';
import { FOOD_KERNEL_VERSION } from '@almanac/food';

describe('@almanac/meals scaffold', () => {
  it('may import the core and the food kernel', () => {
    expect(MEALS_MODULE_VERSION).toBe('0.0.0');
    expect(CORE_VERSION).toBe('0.0.0');
    expect(FOOD_KERNEL_VERSION).toBe('0.0.0');
  });
});
