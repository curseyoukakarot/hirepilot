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
    <div className="space-y-6">
      <div id="inspector-header" className="mb-2">
        <h3 className="text-lg font-semibold mb-4">Field Settings</h3>
        <div className="flex border border-[var(--hp-border)] rounded-xl p-1">
          <button className="flex-1 h-8 rounded-lg bg-[var(--hp-primary)] text-white text-sm font-medium">Field</button>
          <button className="flex-1 h-8 rounded-lg text-sm font-medium text-[var(--hp-text-muted)] hover:bg-white/5">Validation</button>
          <button className="flex-1 h-8 rounded-lg text-sm font-medium text-[var(--hp-text-muted)] hover:bg-white/5">Logic</button>
        </div>
      </div>

      {/* Field panel */}
      {!field ? (
        <div className="text-sm text-[var(--hp-text-muted)]">Select a field to edit</div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Label</label>
            <input
              type="text"
              className="hp-input w-full h-10 px-3 rounded-xl"
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Placeholder</label>
            <input
              type="text"
              className="hp-input w-full h-10 px-3 rounded-xl"
              value={field.placeholder || ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Help Text</label>
            <input
              type="text"
              className="hp-input w-full h-10 px-3 rounded-xl"
              value={field.help_text || ''}
              onChange={(e) => onChange({ help_text: e.target.value })}
            />
          </div>
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="rounded border-[var(--hp-border)]"
              />
              <span className="text-sm font-medium">Required field</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Field Width</label>
            <select
              className="hp-input w-full h-10 px-3 rounded-xl"
              value={field.width}
              onChange={(e) => onChange({ width: (e.target.value as any) })}
            >
              <option value="full">Full width</option>
              <option value="half">Half width</option>
              <option value="third">One third</option>
            </select>
          </div>
          <div className="pt-4 border-t border-[var(--hp-border)]">
            <h4 className="text-sm font-medium mb-3 text-[var(--hp-text-muted)]">Actions</h4>
            <div className="space-y-2">
              <button className="w-full h-9 px-3 rounded-xl text-sm font-medium text-[var(--hp-text-muted)] hover:bg-white/5 text-left" onClick={() => onChange({})}>
                <i className="fa-solid fa-copy w-4 h-4 mr-2"></i>
                Duplicate Field
              </button>
              <button className="w-full h-9 px-3 rounded-xl text-sm font-medium text-[var(--hp-danger)] hover:bg-red-500/10 text-left">
                <i className="fa-solid fa-trash w-4 h-4 mr-2"></i>
                Delete Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission settings */}
      <div className="pt-4 border-t border-[var(--hp-border)]">
        <h4 className="text-sm font-medium mb-3">Submission Settings</h4>
        <label className="block text-sm font-medium mb-2">Destination Type</label>
        <select
          className="hp-input w-full h-10 px-3 rounded-xl mb-3"
          value={form?.destination_type || 'table'}
          onChange={(e) => onFormChange && onFormChange({ destination_type: e.target.value })}
        >
          <option value="table">Custom Table</option>
          <option value="lead">Convert to Lead</option>
          <option value="candidate">Convert to Candidate</option>
        </select>

        {form?.destination_type === 'table' && (
          <>
            <label className="block text-sm font-medium mb-2">Table</label>
            <select
              className="hp-input w-full h-10 px-3 rounded-xl mb-3"
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
            <label className="block text-sm font-medium mb-2">Job Requisition (optional)</label>
            <select
              className="hp-input w-full h-10 px-3 rounded-xl mb-3"
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


