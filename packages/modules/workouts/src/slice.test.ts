import { describe, expect, it } from 'vitest';
import { createDayStore, createMemoryStorage } from '@almanac/core';
import { workoutsDayCodec } from './slice.js';
import { createWorkoutsStore } from './store.js';

const SESSION = {
  id: 's1',
  title: 'Push day',
  exercises: [
    { name: 'Bench press', sets: 3, reps: 8, weightKg: 60 },
    { name: 'Dips', sets: 3, reps: 12, weightKg: null },
  ],
  durationMin: 45,
  note: '',
};

describe('workouts slice codec (L5 degradation)', () => {
  it('round-trips a full session', () => {
    expect(workoutsDayCodec.decode({ sessions: [SESSION] })).toEqual({ sessions: [SESSION] });
  });

  it('a malformed session costs only itself; a bad exercise line only itself', () => {
    const decoded = workoutsDayCodec.decode({
      sessions: [
        SESSION,
        'garbage',
        { title: 'no id' },
        {
          id: 's2',
          title: 'Legs',
          exercises: [{ name: '' }, 7, { name: 'Squat', sets: -1, reps: 'five', weightKg: 80 }],
        },
      ],
    });
    expect(decoded.sessions).toHaveLength(2);
    expect(decoded.sessions[1]).toEqual({
      id: 's2',
      title: 'Legs',
      exercises: [{ name: 'Squat', sets: null, reps: null, weightKg: 80 }],
      durationMin: null,
      note: '',
    });
  });

  it('an absent list is the ordinary empty day', () => {
    expect(workoutsDayCodec.decode({})).toEqual({ sessions: [] });
  });
});

describe('workouts store', () => {
  it('round-trips and reads back only days with sessions', async () => {
    const storage = createMemoryStorage();
    const store = createWorkoutsStore(createDayStore(storage));
    await store.writeDay('2026-07-10', { sessions: [SESSION] });
    await store.writeDay('2026-07-11', { sessions: [] });
    const days = await store.readLoggedDays('2026-07-01', '2026-07-31');
    expect([...days.keys()]).toEqual(['2026-07-10']);
    expect(days.get('2026-07-10')?.sessions[0]?.title).toBe('Push day');
  });
});
