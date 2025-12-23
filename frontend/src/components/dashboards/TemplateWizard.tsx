import React, { useMemo, useState } from 'react';
import type { DashboardTemplate, TemplateRole } from '../../lib/dashboards/templates';

type TableCol = { id?: string; key?: string; name?: string; label?: string; type?: string; currency?: string };
type TableOption = { id: string; name: string; schema_json?: TableCol[] };

type Props = {
  template: DashboardTemplate;
  tables: TableOption[];
  loadingTables: boolean;
  onBack: () => void;
  onCreate: (args: { dashboardName: string; tableId: string; mappings: Record<string, string> }) => Promise<void>;
};

const roleTypeHint: Record<TemplateRole['kind'], string> = {
  currency: 'Money',
  number: 'Number',
  date: 'Date',
  status: 'Status',
  category: 'Category',
  text: 'Text'
};

function colLabel(c: TableCol) {
  return String(c?.label || c?.name || '');
}
function colId(c: TableCol) {
  return String(c?.id || c?.key || c?.name || '');
}
function colType(c: TableCol) {
  return String(c?.type || '').toLowerCase();
}

function isRoleCompatible(role: TemplateRole, col: TableCol) {
  const t = colType(col);
  if (role.kind === 'date') return t === 'date' || /date|created/i.test(colLabel(col));
  if (role.kind === 'currency') return t === 'money' || t === 'currency' || t === 'number' || t === 'formula';
  if (role.kind === 'number') return t === 'number' || t === 'formula' || t === 'money';
  if (role.kind === 'status') return t === 'status' || /status|state/i.test(colLabel(col));
  if (role.kind === 'category') return t === 'text' || t === 'status' || /category|type/i.test(colLabel(col));
  return true;
}

export default function TemplateWizard({ template, tables, loadingTables, onBack, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [dashboardName, setDashboardName] = useState(template.name);
  const [tableId, setTableId] = useState('');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const table = useMemo(() => tables.find((t) => t.id === tableId), [tables, tableId]);
  const schema = useMemo(() => (Array.isArray(table?.schema_json) ? table?.schema_json : []), [table]);

  const requiredRoles = template.requirements.filter((r) => r.required);
  const missingRequired = requiredRoles.filter((r) => !mappings[r.id]);

  const nextEnabled = useMemo(() => {
    if (step === 1) return Boolean(tableId);
    if (step === 2) return missingRequired.length === 0;
    return true;
  }, [step, tableId, missingRequired.length]);

  const setRole = (roleId: string, value: string) => {
    setMappings((m) => ({ ...m, [roleId]: value }));
  };

  const typeBadge = (t: string) => {
    const kind = t === 'money' ? 'currency' : t;
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/60 border border-white/10">
        {String(kind || 'text')}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-white text-xl font-semibold">{template.name}</div>
          <div className="mt-1 text-sm text-white/50">{template.description}</div>
        </div>
        <button onClick={onBack} className="text-white/60 hover:text-white transition text-sm">
          ← Back
        </button>
      </div>

      {/* Stepper */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { n: 1, label: 'Table' },
          { n: 2, label: 'Map Columns' },
          { n: 3, label: 'Preview' },
          { n: 4, label: 'Create' }
        ].map((s) => (
          <div
            key={s.n}
            className={`rounded-lg border px-3 py-2 text-xs ${
              step === s.n ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/60'
            }`}
          >
            <span className="font-semibold mr-2">{s.n}</span>
            {s.label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Dashboard name</div>
            <input
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
              placeholder="Executive Overview"
            />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Select table</div>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="">{loadingTables ? 'Loading…' : 'Choose a table'}</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] space-y-4">
          <div className="text-sm text-white/70">
            Map template roles to your table columns. Required roles are marked.
          </div>
          <div className="space-y-3">
            {template.requirements.map((role) => {
              const current = mappings[role.id] || '';
              const options = schema.filter((c) => isRoleCompatible(role, c));
              return (
                <div key={role.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <div className="md:col-span-1">
                    <div className="text-white font-medium">
                      {role.label}{' '}
                      {role.required ? <span className="text-red-300 text-xs">(required)</span> : <span className="text-white/40 text-xs">(optional)</span>}
                    </div>
                    <div className="text-xs text-white/40">
                      {roleTypeHint[role.kind]}{role.description ? ` · ${role.description}` : ''}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <select
                      value={current}
                      onChange={(e) => setRole(role.id, e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                    >
                      <option value="">{role.required ? 'Select a column' : 'None'}</option>
                      {options.map((c) => (
                        <option key={colId(c)} value={colId(c)}>
                          {colLabel(c)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-xs text-white/35">
                      {current ? `Selected: ${options.find(o => colId(o) === current)?.label || options.find(o => colId(o) === current)?.name || 'Column'} (${roleTypeHint[role.kind]})` : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {missingRequired.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-lg px-3 py-2 text-sm">
              Missing required mappings: {missingRequired.map((r) => r.label).join(', ')}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] space-y-4">
          <div className="text-white/70 text-sm">
            Preview (mock). Once created, the dashboard will query your real data and show empty states instead of zeros.
          </div>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-8 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-white font-semibold">Revenue vs Cost</div>
              <div className="mt-3 h-40 rounded-lg bg-white/5 border border-white/10" />
            </div>
            <div className="col-span-12 lg:col-span-4 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-white font-semibold">Health</div>
              <div className="mt-3 space-y-2">
                {['Healthy', 'At Risk', 'Not Viable'].map((x) => (
                  <div key={x} className="flex items-center justify-between text-sm text-white/70">
                    <span>{x}</span>
                    <span className="text-white/50">—</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-12 rounded-xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-white font-semibold">KPI Row</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {['Total Revenue', 'Total Cost', 'Profit', 'Margin %'].map((k) => (
                  <div key={k} className="rounded-xl border border-white/10 bg-zinc-950/60 backdrop-blur px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                    <div className="text-xs uppercase tracking-wider text-white/50">{k}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">—</div>
                    <div className="mt-1 text-xs text-white/40">vs last period</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] space-y-3">
          <div className="text-white font-semibold">Ready to create</div>
          <div className="text-sm text-white/60">
            We’ll generate an executive dashboard using <span className="text-white">{template.name}</span> on{' '}
            <span className="text-white">{table?.name || 'your table'}</span>.
          </div>
        </div>
      )}

      {/* Footer buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as any) : s))}
          disabled={step === 1}
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/80 disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => ((s + 1) as any))}
              disabled={!nextEnabled}
              className="px-5 py-2 rounded-xl bg-white text-zinc-900 hover:opacity-90 transition text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={async () => {
                try {
                  setSaving(true);
                  await onCreate({ dashboardName, tableId, mappings });
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Dashboard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


