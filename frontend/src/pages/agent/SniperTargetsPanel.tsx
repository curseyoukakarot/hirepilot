import React from 'react';
import SniperTargets from '../../screens/SniperTargets';
import { usePlan } from '../../context/PlanContext';

export default function SniperTargetsPanel(){
  const { role } = usePlan() as any;
  const normalized = String(role || '').toLowerCase().replace(/\s|-/g, '_');
  const isSuperAdmin = ['super_admin','superadmin'].includes(normalized);
  if (!isSuperAdmin) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4 text-white">Sniper Targets</h2>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-1">Coming Soon</h3>
            <p className="text-sm text-blue-700">This feature will be ready shortly.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-white">Sniper Targets</h2>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <SniperTargets />
      </div>
    </div>
  );
}


