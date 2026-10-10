import { it, expect } from 'vitest';
import { Progression } from '../src/game/progression.js';
const beaters = [{id:'starter',unlockCarpets:0},{id:'next',unlockCarpets:2}];

it('persists completions and selection, unlocking each beater once', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key,value) => values.set(key,value) };
  const progress = new Progression(beaters, storage);
  expect(progress.select('next')).toBe(false);
  expect(progress.completeCarpet()).toEqual([]);
  expect(progress.completeCarpet()).toEqual([beaters[1]]);
  expect(progress.completeCarpet()).toEqual([]);
  expect(progress.select('next')).toBe(true);
  const restored = new Progression(beaters, storage);
  expect(restored.total).toBe(3);
  expect(restored.selected).toBe('next');
});

it('rejects unknown or locked saved choices and tolerates blocked storage', () => {
  const locked = new Progression(beaters, { getItem: key => key.endsWith('beater') ? 'next' : '0' });
  expect(locked.selected).toBe('starter');
  expect(locked.select('unknown')).toBe(false);
  const blocked = new Progression(beaters, {getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});
  expect(() => blocked.completeCarpet()).not.toThrow();
  expect(blocked.select('starter')).toBe(true);
});
