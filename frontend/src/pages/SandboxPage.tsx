import React, { useMemo, useState } from 'react';
import { workflowLibrary, type WorkflowRecipe } from '../data/workflowLibrary';

export default function SandboxPage() {
  const [selected, setSelected] = useState<WorkflowRecipe | null>(null);
  const categories = useMemo(() => Array.from(new Set(workflowLibrary.map(w => w.category))), []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workflow Sandbox</h1>
        {selected && (
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg" onClick={() => alert('Loaded template: ' + selected.title)}>
            Load Template
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {categories.map((c) => (
          <span key={c} className="px-3 py-1 rounded-full text-xs bg-slate-800 text-white">{c}</span>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workflowLibrary.map((wf) => (
          <button key={wf.id} className="text-left rounded-xl border border-slate-700 bg-slate-900 p-4 hover:bg-slate-800" onClick={() => setSelected(wf)}>
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-white">{wf.title}</div>
              <span className="text-lg" title={wf.category}>{wf.icon}</span>
            </div>
            <div className="text-slate-300 text-sm">{wf.description}</div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950 p-6">
          <h2 className="text-xl font-semibold text-white mb-2">{selected.title}</h2>
          <div className="text-slate-300 text-sm mb-4">{selected.description}</div>
          <pre className="text-xs bg-slate-900 rounded p-4 text-slate-200 overflow-auto">{JSON.stringify(selected.recipeJSON || {
            name: selected.title,
            trigger: selected.trigger,
            actions: selected.actions,
          }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}


