import { describe, it, expect } from 'vitest';
import { canPlan, canRole, isLocked } from './permissions';

describe('permissions', () => {
  it('respects plan limits', () => {
    expect(canPlan('invite', 'pro', { collabCount: 1 })).toBe(true);
    expect(canPlan('invite', 'pro', { collabCount: 2 })).toBe(false);
    expect(canPlan('pipeline', 'free')).toBe(false);
    expect(canPlan('edit', 'team')).toBe(true);
  });

  it('checks collaborator roles', () => {
    expect(canRole('comment', 'viewer')).toBe(false);
    expect(canRole('comment', 'commenter')).toBe(true);
    expect(canRole('edit', 'commenter')).toBe(false);
    expect(canRole('edit', 'editor')).toBe(true);
  });

  it('detects locked plans', () => {
    expect(isLocked('free')).toBe(true);
    expect(isLocked('starter')).toBe(true);
    expect(isLocked('team')).toBe(false);
  });
});
