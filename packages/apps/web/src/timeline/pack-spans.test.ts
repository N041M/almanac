import { describe, expect, it } from 'vitest';
import { packSpans } from './pack-spans';

const span = (id: string, start: number, end: number) => ({ id, start, end });

describe('packSpans (5.4: nothing hidden behind anything)', () => {
  it('disjoint spans each get the full width', () => {
    const packed = packSpans([span('a', 0, 60), span('b', 120, 180)]);
    expect(packed).toEqual([
      { id: 'a', start: 0, end: 60, lane: 0, lanes: 1 },
      { id: 'b', start: 120, end: 180, lane: 0, lanes: 1 },
    ]);
  });

  it('overlapping spans sit side by side', () => {
    const packed = packSpans([span('a', 0, 120), span('b', 60, 180)]);
    expect(packed.find((p) => p.id === 'a')).toMatchObject({ lane: 0, lanes: 2 });
    expect(packed.find((p) => p.id === 'b')).toMatchObject({ lane: 1, lanes: 2 });
  });

  it('a chain cluster shares its lane count; freed lanes are reused', () => {
    // a overlaps b, b overlaps c, but a and c do not — one cluster, two lanes.
    const packed = packSpans([span('a', 0, 100), span('b', 50, 150), span('c', 110, 200)]);
    expect(packed.every((p) => p.lanes === 2)).toBe(true);
    expect(packed.find((p) => p.id === 'c')?.lane).toBe(0); // a's lane, freed
  });

  it('separate clusters size independently', () => {
    const packed = packSpans([
      span('a', 0, 60),
      span('b', 30, 90), // cluster 1: two lanes
      span('c', 200, 260), // cluster 2: alone
    ]);
    expect(packed.find((p) => p.id === 'b')?.lanes).toBe(2);
    expect(packed.find((p) => p.id === 'c')).toMatchObject({ lane: 0, lanes: 1 });
  });

  it('an inverted span is clamped to minimal duration — rendered, never dropped (L5)', () => {
    const packed = packSpans([span('bad', 100, 40)]);
    expect(packed).toHaveLength(1);
    expect(packed[0]?.end).toBe(101);
  });
});
