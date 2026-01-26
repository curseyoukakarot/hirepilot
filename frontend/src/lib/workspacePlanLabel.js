export function workspacePlanLabel(plan, role) {
  const value = String(plan || '').toLowerCase();
  const roleValue = String(role || '').toLowerCase().replace(/[\s-]/g, '_');
  if (roleValue === 'super_admin' || roleValue === 'superadmin') return 'Super Admin';
  if (roleValue === 'admin') return 'Admin';
  if (roleValue === 'team_admin' || roleValue === 'teamadmin') return 'Team Admin';
  if (roleValue === 'owner') return 'Owner';
  if (roleValue === 'member') return 'Member';
  if (roleValue === 'viewer') return 'Viewer';
  if (value === 'free') return 'Free';
  if (value === 'starter') return 'Starter';
  if (value === 'member') return 'Starter';
  if (value === 'team') return 'Team Admin';
  if (value === 'team_admin') return 'Team Admin';
  return 'Free';
}
