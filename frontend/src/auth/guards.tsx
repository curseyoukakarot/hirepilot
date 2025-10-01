import React from 'react';
import { usePlan } from '../context/PlanContext';

export function RequireRole({ allow, children }: { allow: string | string[]; children: React.ReactNode }) {
  const { role, loading } = usePlan();
  const allowed = Array.isArray(allow) ? allow.map(r => String(r).toLowerCase()) : [String(allow).toLowerCase()];
  if (loading) return null;
  const current = String(role || '').toLowerCase();
  if (!current || !allowed.includes(current)) return null;
  return <>{children}</>;
}

export function RequirePlan({ allow, children }: { allow: string | string[]; children: React.ReactNode }) {
  const { plan, loading } = usePlan();
  const allowed = Array.isArray(allow) ? allow.map(p => String(p).toLowerCase()) : [String(allow).toLowerCase()];
  if (loading) return null;
  const current = String(plan || '').toLowerCase();
  if (!current || !allowed.includes(current)) return null;
  return <>{children}</>;
}


