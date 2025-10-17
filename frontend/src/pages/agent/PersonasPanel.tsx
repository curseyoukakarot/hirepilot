import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPersonas, createPersona } from '../../lib/api/personas';

type Persona = {
  id: string;
  name: string;
  role: string;
  description?: string;
  location?: string;
  leadStats?: string;
};

export default function PersonasPanel(props: {
  onUseInScheduler?: (persona: Persona) => void;
  onCreatePersona?: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const data = await listPersonas();
        setItems(data || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      {loading && (<div className="text-slate-400">Loading personas…</div>)}
      {!loading && items.length === 0 && (
        <div className="bg-slate-800 rounded-xl border-2 border-dashed border-slate-600 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center mb-4"><i className="fa-solid fa-plus text-slate-400 text-xl" /></div>
          <h3 className="font-semibold text-white mb-2">No personas yet</h3>
          <p className="text-sm text-slate-400 mb-4">Create your first persona to define target profiles</p>
          <button disabled={creating} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors" onClick={async ()=>{
            try { setCreating(true); const created = await createPersona({ name:'New Persona', titles:[], include_keywords:[], exclude_keywords:[], locations:[], channels:['email'] }); setItems([created, ...items]); } finally { setCreating(false); }
          }}>+ Create Persona</button>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((p:any) => (
            <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:shadow-xl hover:shadow-primary/10 transition-all hover:border-slate-600">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center"><i className="fa-solid fa-user-tie text-white" /></div>
                <button className="text-slate-500 hover:text-slate-300"><i className="fa-solid fa-ellipsis-h" /></button>
              </div>
              <h3 className="font-semibold text-white mb-3">{p.name}</h3>
              <div className="flex flex-wrap gap-1 mb-3">{(p.titles||[]).slice(0,3).map((t:string)=>(<span key={t} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">{t}</span>))}</div>
              <div className="flex items-center text-sm text-slate-400 mb-4"><i className="fa-solid fa-location-dot w-4 mr-2" /><span>{(p.locations||[]).slice(0,3).join(', ')||'Any'}</span></div>
              <div className="border-t border-slate-700 pt-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button className="flex items-center justify-center px-3 py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors" onClick={()=>navigate(`/agent/advanced/console?persona=${p.id}`)}><i className="fa-solid fa-comments mr-2" />Use in Chat</button>
                  <button className="flex items-center justify-center px-3 py-2 bg-secondary/20 text-secondary rounded-lg text-sm font-medium hover:bg-secondary/30 transition-colors" onClick={()=>props.onUseInScheduler && props.onUseInScheduler(p)}><i className="fa-solid fa-clock mr-2" />Use in Scheduler</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


