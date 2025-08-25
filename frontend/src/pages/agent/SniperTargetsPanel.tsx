import React from 'react';
import SniperTargets from '../../screens/SniperTargets';

export default function SniperTargetsPanel(){
  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-white">Sniper Targets</h2>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <SniperTargets panelMode />
      </div>
    </div>
  );
}


