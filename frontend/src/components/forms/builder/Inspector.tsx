import React from 'react';
import type { BuilderField } from '../types';

type Props = {
  field: BuilderField | null;
  onChange: (patch: Partial<BuilderField>) => void;
  form?: any | null;
  onFormChange?: (patch: Record<string, any>) => void;
  tables?: { id: string; name: string }[];
  jobReqs?: { id: string; title: string; status?: string }[];
};

export function Inspector({ field, onChange, form, onFormChange, tables = [], jobReqs = [] }: Props) {
  return (
    <div className="p-3 border-l min-w-[280px] space-y-6">
      <div>
        <div className="font-semibold mb-3">Field</div>
        {!field ? (
          <div className="text-sm text-muted-foreground">Select a field to edit</div>
        ) : (
          <>
            <label className="block text-xs mb-1">Label</label>
            <input
              className="w-full border rounded px-2 py-1 mb-3"
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
            />
            <label className="block text-xs mb-1">Required</label>
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
          </>
        )}
      </div>

      <div>
        <div className="font-semibold mb-3">Submission Settings</div>
        <label className="block text-xs mb-1">Destination Type</label>
        <select
          className="w-full border rounded px-2 py-1 mb-3"
          value={form?.destination_type || 'table'}
          onChange={(e) => onFormChange && onFormChange({ destination_type: e.target.value })}
        >
          <option value="table">Custom Table</option>
          <option value="lead">Convert to Lead</option>
          <option value="candidate">Convert to Candidate</option>
        </select>

        {form?.destination_type === 'table' && (
          <>
            <label className="block text-xs mb-1">Table</label>
            <select
              className="w-full border rounded px-2 py-1 mb-3"
              value={form?.destination_target_id || ''}
              onChange={(e) => onFormChange && onFormChange({ destination_target_id: e.target.value || null })}
            >
              <option value="">Select table…</option>
              {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        )}

        {form?.destination_type === 'candidate' && (
          <>
            <label className="block text-xs mb-1">Job Requisition (optional)</label>
            <select
              className="w-full border rounded px-2 py-1 mb-3"
              value={form?.job_req_id || ''}
              onChange={(e) => onFormChange && onFormChange({ job_req_id: e.target.value || null })}
            >
              <option value="">None</option>
              {jobReqs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </>
        )}
      </div>
    </div>
  );
}

export default Inspector;


