import { describe, expect, it } from '@jest/globals';
import { moveId, reorderByOrderedIds } from '../src/services/kanban/positions';

describe('kanban move/reorder helpers', () => {
  it('moves within the same list', () => {
    const initial = ['a', 'b', 'c', 'd'];
    const moved = moveId(initial, 'c', 1);
    expect(moved).toEqual(['a', 'c', 'b', 'd']);
  });

  it('moves to a different list', () => {
    const from = ['a', 'b', 'c'];
    const to = ['x', 'y'];
    const nextFrom = from.filter((id) => id !== 'b');
    const nextTo = moveId(to, 'b', 1);
    expect(nextFrom).toEqual(['a', 'c']);
    expect(nextTo).toEqual(['x', 'b', 'y']);
  });

  it('handles concurrent moves by applying sequentially', () => {
    const initial = ['a', 'b', 'c', 'd'];
    const afterFirst = moveId(initial, 'a', 3);
    const afterSecond = moveId(afterFirst, 'd', 0);
    expect(afterFirst).toEqual(['b', 'c', 'd', 'a']);
    expect(afterSecond).toEqual(['d', 'b', 'c', 'a']);
  });

  it('reorders with canonical order and appends missing', () => {
    const existing = ['a', 'b', 'c', 'd'];
    const ordered = reorderByOrderedIds(existing, ['d', 'b']);
    expect(ordered).toEqual(['d', 'b', 'a', 'c']);
  });
});

