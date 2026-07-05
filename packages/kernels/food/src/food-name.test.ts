import { describe, expect, it } from 'vitest';
import { normalizeFoodName, sameFoodName } from './food-name.js';

describe('normalizeFoodName', () => {
  it('folds case, diacritics, and whitespace', () => {
    expect(normalizeFoodName('  Créme   Fraîche ')).toBe('creme fraiche');
    expect(normalizeFoodName('ONION')).toBe('onion');
  });

  it('singularizes common English plurals', () => {
    expect(normalizeFoodName('onions')).toBe('onion');
    expect(normalizeFoodName('berries')).toBe('berry');
    expect(normalizeFoodName('tomatoes')).toBe('tomato');
    expect(normalizeFoodName('potatoes')).toBe('potato');
    expect(normalizeFoodName('radishes')).toBe('radish');
    expect(normalizeFoodName('green beans')).toBe('green bean');
  });

  it('short e-stems drop only the s — the -oes rule needs a long stem', () => {
    expect(normalizeFoodName('toes')).toBe('toe');
    expect(normalizeFoodName('shoes')).toBe('shoe');
    expect(normalizeFoodName('mangoes')).toBe('mango');
  });

  it('leaves non-plural s-endings alone', () => {
    expect(normalizeFoodName('hummus')).toBe('hummus');
    expect(normalizeFoodName('asparagus')).toBe('asparagus');
    expect(normalizeFoodName('watercress')).toBe('watercress');
    expect(normalizeFoodName('gas')).toBe('gas');
  });

  it('sameFoodName: identity for entered variants, never fuzzy', () => {
    expect(sameFoodName('Onions', ' onion ')).toBe(true);
    expect(sameFoodName('Berries', 'berry')).toBe(true);
    // one edit apart is NOT the same ingredient — confirm, don't guess
    expect(sameFoodName('beef', 'beet')).toBe(false);
  });
});
