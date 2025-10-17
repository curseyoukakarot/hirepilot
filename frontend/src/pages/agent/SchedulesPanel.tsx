import React from 'react';

type Schedule = {
  id: string;
  name: string;
  type: 'Recurring' | 'One-Time';
  nextRun: string;
  linkType?: 'Persona' | 'Campaign';
  linkName?: string;
};

export default function SchedulesPanel(props: {
  schedules?: Schedule[];
  onCreate?: () => void;
  onEdit?: (id: string) => void;
  onPause?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [items, setItems] = React.useState<Schedule[]>(props.schedules || []);
  React.useEffect(() => { (async () => {
    try {
      const resp = await fetch('/api/schedules');
      if (resp.ok) {
        const data = await resp.json();
        setItems((data || []).map((d: any) => ({ id: d.id, name: d.name, type: d.schedule_kind === 'recurring' ? 'Recurring' : 'One-Time', nextRun: d.next_run_at || '-', linkType: d.persona_id ? 'Persona' : (d.campaign_id ? 'Campaign' : undefined), linkName: d.persona_id || d.campaign_id })));
      }
    } catch {}
  })(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Schedules & Automations</h2>
          <p className="text-slate-400">Manage your automated sourcing and campaign schedules</p>
        </div>
        <button className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors" onClick={() => props.onCreate && props.onCreate()}>
          <i className="fa-solid fa-plus mr-2" />
          Schedule Action
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-16 border border-dashed border-slate-700 rounded-xl bg-slate-900">
          <h3 className="text-white text-lg mb-1">No automations yet</h3>
          <p className="text-slate-400 mb-3">Create a Schedule to automate sourcing, messaging, or campaigns</p>
          <button className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm" onClick={() => props.onCreate && props.onCreate()}>+ New Schedule</button>
        </div>
      )}

      {items.length > 0 && (
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h3 className="font-semibold text-white">Active Jobs</h3>
        </div>
        <div className="divide-y divide-slate-700">
          {items.map((s) => (
            <div key={s.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-users text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white">{s.name}</h4>
                  <p className="text-sm text-slate-400">{s.type} • {s.linkType || 'Linked'} {s.linkName ? `• ${s.linkName}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-400">Next: {s.nextRun}</span>
                <div className="flex items-center space-x-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                  <button className="text-slate-400 hover:text-slate-300">
                    <i className="fa-solid fa-ellipsis-h" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}


