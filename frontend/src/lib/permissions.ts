export type Plan = 'free' | 'starter' | 'pro' | 'team';
export type CollabRole = 'viewer' | 'commenter' | 'editor';
export type Feature = 'invite' | 'comment' | 'edit' | 'pipeline' | 'activity';

export function canPlan(feature: Feature, plan: Plan, ctx?: { collabCount?: number }): boolean {
  if (plan === 'free' || plan === 'starter') {
    return false;
  }
  if (plan === 'pro') {
    if (feature === 'invite') {
      return (ctx?.collabCount ?? 0) < 2;
    }
    return true;
  }
  return true;
}

export function canRole(action: 'comment' | 'edit', role: CollabRole): boolean {
  if (action === 'comment') return role === 'commenter' || role === 'editor';
  if (action === 'edit') return role === 'editor';
  return false;
}

export const isLocked = (plan: Plan): boolean => plan === 'free' || plan === 'starter';
