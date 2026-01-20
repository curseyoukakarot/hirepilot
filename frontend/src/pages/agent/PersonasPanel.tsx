import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPersonas, createPersona, deletePersona } from '../../lib/api/personas';
import PersonaForm from './personas/PersonaForm';

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
  const [showForm, setShowForm] = useState(false);
  const [editPersona, setEditPersona] = useState<any | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
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

  // Close dropdown when clicking elsewhere / pressing Escape
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest('[data-persona-menu-root="true"]')) return;
      setOpenMenuId(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const refresh = async () => {
    try {
      const data = await listPersonas();
      setItems(data || []);
    } catch {}
  };

  const handleDuplicate = async (p: any) => {
    try {
      setActionBusyId(p.id);
      const baseName = String(p?.name || 'Persona').trim() || 'Persona';
      const copyName = `${baseName} (copy)`;
      await createPersona({
        name: copyName,
        titles: Array.isArray(p?.titles) ? p.titles : [],
        include_keywords: Array.isArray(p?.include_keywords) ? p.include_keywords : [],
        exclude_keywords: Array.isArray(p?.exclude_keywords) ? p.exclude_keywords : [],
        locations: Array.isArray(p?.locations) ? p.locations : [],
        channels: Array.isArray(p?.channels) ? p.channels : ['email'],
        goal_total_leads: typeof p?.goal_total_leads === 'number' ? p.goal_total_leads : null
      });
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Failed to duplicate persona');
    } finally {
      setActionBusyId(null);
      setOpenMenuId(null);
    }
  };

  const handleDelete = async (p: any) => {
    const ok = window.confirm(`Delete persona "${p?.name || 'Untitled'}"? This cannot be undone.`);
    if (!ok) return;
    try {
      setActionBusyId(p.id);
      await deletePersona(p.id);
      setItems(prev => prev.filter(x => x.id !== p.id));
    } catch (e: any) {
      alert(e?.message || 'Failed to delete persona');
    } finally {
      setActionBusyId(null);
      setOpenMenuId(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate('/agent')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          ← Back to Agent Center
        </button>
      </div>
      {loading && (<div className="text-slate-400">Loading personas…</div>)}
      {!loading && items.length === 0 && (
        <div className="bg-slate-800 rounded-xl border-2 border-dashed border-slate-600 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center mb-4"><i className="fa-solid fa-plus text-slate-400 text-xl" /></div>
          <h3 className="font-semibold text-white mb-2">No personas yet</h3>
          <p className="text-sm text-slate-400 mb-4">Create your first persona to define target profiles</p>
          <button disabled={creating} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors" onClick={()=>setShowForm(true)}>+ Create Persona</button>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((p:any) => (
            <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:shadow-xl hover:shadow-primary/10 transition-all hover:border-slate-600">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center"><i className="fa-solid fa-user-tie text-white" /></div>
                <div className="relative" data-persona-menu-root="true">
                  <button
                    className="text-slate-500 hover:text-slate-300"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(prev => prev === p.id ? null : p.id); }}
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === p.id}
                    aria-label="Persona actions"
                  >
                    <i className="fa-solid fa-ellipsis-h" />
                  </button>
                  {openMenuId === p.id && (
                    <div className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-700 bg-slate-900 shadow-lg z-50 overflow-hidden">
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                        onClick={(e) => { e.preventDefault(); setOpenMenuId(null); setEditPersona(p); setShowForm(true); }}
                      >
                        <i className="fa-solid fa-pen-to-square text-slate-300 w-4" />
                        Edit
                      </button>
                      <button
                        className={`w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2 ${actionBusyId === p.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                        onClick={(e) => { e.preventDefault(); if (actionBusyId) return; handleDuplicate(p); }}
                        disabled={!!actionBusyId}
                      >
                        <i className="fa-solid fa-clone text-slate-300 w-4" />
                        Duplicate
                      </button>
                      <button
                        className={`w-full text-left px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 flex items-center gap-2 ${actionBusyId === p.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                        onClick={(e) => { e.preventDefault(); if (actionBusyId) return; handleDelete(p); }}
                        disabled={!!actionBusyId}
                      >
                        <i className="fa-solid fa-trash text-red-300 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <h3 className="font-semibold text-white mb-3">{p.name}</h3>
              <div className="flex flex-wrap gap-1 mb-3">
                {(p.titles||[]).slice(0,3).map((t:string, idx:number)=>{
                  const palette = [
                    { bg: 'bg-blue-500/20', text: 'text-blue-300' },
                    { bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
                    { bg: 'bg-violet-500/20', text: 'text-violet-300' },
                    { bg: 'bg-amber-500/20', text: 'text-amber-300' }
                  ];
                  const c = palette[idx % palette.length];
                  return (
                    <span key={t} className={`px-2 py-1 ${c.bg} ${c.text} rounded-full text-xs`}>{t}</span>
                  );
                })}
              </div>
              <div className="flex items-center text-sm text-slate-400 mb-4"><i className="fa-solid fa-location-dot w-4 mr-2" /><span>{(p.locations||[]).slice(0,3).join(', ')||'Any'}</span></div>
              <div className="border-t border-slate-700 pt-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button className="flex items-center justify-center px-3 py-2 bg-blue-500/15 text-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-500/25 hover:text-blue-100 transition-colors" onClick={()=>navigate(`/agent/advanced/console?persona=${p.id}`)}>
                    <i className="fa-solid fa-comments mr-2" />Use in Chat
                  </button>
                  <button className="flex items-center justify-center px-3 py-2 bg-violet-500/15 text-violet-200 rounded-lg text-sm font-semibold hover:bg-violet-500/25 hover:text-violet-100 transition-colors" onClick={()=>props.onUseInScheduler && props.onUseInScheduler(p)}>
                    <i className="fa-solid fa-clock mr-2" />Use in Scheduler
                  </button>
                </div>
                <div className="flex">
                  <button className="flex-1 px-3 py-2 border border-slate-600 rounded-lg text-sm hover:bg-slate-700 text-slate-300" onClick={()=>{ setEditPersona(p); setShowForm(true); }}>Edit</button>
                </div>
              </div>
            </div>
          ))}
          {/* Ghost CTA Card */}
          <button
            onClick={()=>setShowForm(true)}
            className="rounded-xl border-2 border-dashed border-slate-600 hover:border-blue-400 hover:bg-slate-800/40 transition-colors p-6 flex items-center justify-center text-center"
          >
            <div>
              <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300">
                <i className="fa-solid fa-plus" />
              </div>
              <div className="text-white font-medium">Create Persona</div>
              <div className="text-slate-400 text-sm">Add another target profile</div>
            </div>
          </button>
        </div>
      )}
      {showForm && (
        <PersonaForm
          open={showForm}
          initial={editPersona}
          onClose={async (saved)=>{
            setShowForm(false); setEditPersona(null);
            if (saved) {
              try { const data = await listPersonas(); setItems(data||[]); } catch {}
            }
          }}
        />
      )}
    </div>
  );
}


