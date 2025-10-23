import React from 'react';
import { workflowLibrary } from '../../../frontend/src/data/workflowLibrary';

export default function WorkflowsPublicPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Workflows Library</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {workflowLibrary.map((wf) => (
          <div key={wf.id} className="rounded-xl border border-slate-200 p-5 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{wf.title}</h3>
              <span title={wf.category}>{wf.icon}</span>
            </div>
            <p className="text-sm text-slate-600 mb-3">{wf.description}</p>
            <div className="text-xs text-slate-500">
              <div><strong>Trigger:</strong> {wf.trigger}</div>
              <div className="mt-1"><strong>Actions:</strong> {wf.actions.map(a => a.endpoint).join(', ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


