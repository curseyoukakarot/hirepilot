export function workspacePlanLabel(plan) {
  const value = String(plan || '').toLowerCase();
  if (value === 'free') return 'Free';
  if (value === 'starter') return 'Starter';
  if (value === 'member') return 'Starter';
  if (value === 'team') return 'Team Admin';
  if (value === 'team_admin') return 'Team Admin';
  return 'Free';
}
