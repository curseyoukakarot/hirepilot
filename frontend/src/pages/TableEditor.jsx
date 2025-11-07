import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function TableEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tableName, setTableName] = useState('Untitled Table');
  const [lastSavedName, setLastSavedName] = useState('Untitled Table');
  const [saving, setSaving] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);
  const [schema, setSchema] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [showShare, setShowShare] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [addingUserId, setAddingUserId] = useState('');
  const [addingRole, setAddingRole] = useState('view');
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const apiFetch = async (url, init = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = { 'Content-Type': 'application/json', ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const resp = await fetch(url, { ...init, headers, credentials: 'include' });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const { data } = await apiFetch(`/api/tables/${encodeURIComponent(id)}`);
        if (data?.name) { setTableName(String(data.name)); setLastSavedName(String(data.name)); }
        setSchema(Array.isArray(data?.schema_json) ? data.schema_json : []);
        setRows(Array.isArray(data?.data_json) ? data.data_json : []);
        setCollaborators(Array.isArray(data?.collaborators) ? data.collaborators : []);
      } catch {}
    };
    load();
  }, [id]);

  // Determine permission and load team members list
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setCanManageAccess(false); return; }
        const { data: me } = await supabase.from('users').select('role, team_id').eq('id', user.id).maybeSingle();
        const roleLc = String(me?.role || '').toLowerCase();
        const isSuper = ['super_admin','superadmin'].includes(roleLc);
        const isTeamAdmin = roleLc === 'team_admin';
        setCanManageAccess(isSuper || isTeamAdmin);
        if (me?.team_id) {
          const { data: members } = await supabase.from('users').select('id, email').eq('team_id', me.team_id);
          setTeamMembers(Array.isArray(members) ? members : []);
        } else {
          setTeamMembers([]);
        }
      } catch { setCanManageAccess(false); }
    })();
  }, []);

  // Realtime presence stub
  useEffect(() => {
    let channel;
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!id) return;
        channel = supabase.channel(`tables:${id}`, {
          config: { presence: { key: user?.id || 'anon' } },
        });
        channel.on('presence', { event: 'sync' }, () => {
          try {
            const state = channel.presenceState();
            const total = Object.values(state || {}).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
            if (mounted) setPresenceCount(total || 1);
          } catch {}
        });
        await channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try { await channel.track({ joined_at: Date.now() }); } catch {}
          }
        });
      } catch {}
    })();
    return () => {
      mounted = false;
      try { if (channel) supabase.removeChannel(channel); } catch {}
    };
  }, [id]);

  const onSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await apiFetch(`/api/tables/${encodeURIComponent(id)}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ name: tableName }),
      });
      setLastSavedName(tableName);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const importFrom = async (src) => {
    if (!id) return;
    try {
      setSaving(true);
      await apiFetch(`/api/tables/${encodeURIComponent(id)}/import`, {
        method: 'POST',
        body: JSON.stringify({ source: src }),
      });
      // reload after import
      try {
        const { data } = await apiFetch(`/api/tables/${encodeURIComponent(id)}`);
        setSchema(Array.isArray(data?.schema_json) ? data.schema_json : []);
        setRows(Array.isArray(data?.data_json) ? data.data_json : []);
      } catch {}
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleAddColumn = async (type) => {
    if (!id) return;
    const existingNames = (schema || []).map((c) => String(c.name || ''));
    let idx = existingNames.length + 1;
    let name = `New Column ${idx}`;
    while (existingNames.includes(name)) { idx += 1; name = `New Column ${idx}`; }
    const newCol = type === 'formula' ? { name, type, formula: '=0' } : { name, type };
    const nextSchema = [...schema, newCol];
    try {
      setSaving(true);
      const { data } = await apiFetch(`/api/tables/${encodeURIComponent(id)}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ schema_json: nextSchema, data_json: rows }),
      });
      setSchema(Array.isArray(data?.schema_json) ? data.schema_json : nextSchema);
      setRows(Array.isArray(data?.data_json) ? data.data_json : rows);
    } catch {}
    finally { setSaving(false); setColumnMenuOpen(false); }
  };

  const handleAddRow = async () => {
    if (!id) return;
    const empty = {};
    (schema || []).forEach((c) => { empty[c.name] = c.type === 'number' ? 0 : c.type === 'date' ? null : ''; });
    const next = [...rows, empty];
    try {
      setSaving(true);
      const { data } = await apiFetch(`/api/tables/${encodeURIComponent(id)}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ data_json: next }),
      });
      setRows(Array.isArray(data?.data_json) ? data.data_json : next);
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <div className="bg-gray-50 font-sans min-h-screen flex flex-col">
      {/* EXACT SOURCE START (layout/content preserved as-is) */}
      <div id="table-editor" className="min-h-screen flex flex-col">
        <header id="header" className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-gray-600 hover:text-gray-800 transition-colors" onClick={() => navigate('/tables')}>
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div className="relative">
                <i className="fas fa-pen text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e)=>setTableName(e.target.value)}
                  onBlur={() => { if (tableName && tableName.trim() !== lastSavedName) onSave(); }}
                  placeholder="Name your table…"
                  title="Click to rename your table"
                  className="pl-7 pr-3 text-2xl font-semibold text-gray-900 bg-gray-50 border border-transparent outline-none focus:bg-white focus:border-purple-300 rounded px-2 py-1 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { if (canManageAccess) setShowShare(true); else window.alert('Only team admins can manage access'); }} className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-60" disabled={!canManageAccess}>
                <i className="fas fa-share-alt mr-2"></i>Share
              </button>
              <button onClick={onSave} disabled={saving} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-70">
                <i className="fas fa-save mr-2"></i>{saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </header>
        <div id="toolbar" className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button id="add-column-btn" onClick={() => setColumnMenuOpen(v=>!v)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-plus text-sm"></i>
                Add Column
                <i className="fas fa-chevron-down text-xs"></i>
              </button>
              <div id="column-dropdown" className={`${columnMenuOpen ? '' : 'hidden'} absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50`}>
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">COLUMN TYPES</div>
                  <div className="space-y-1">
                    <button onClick={()=>handleAddColumn('text')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-font text-gray-400"></i>Text</button>
                    <button onClick={()=>handleAddColumn('status')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-circle text-purple-400"></i>Status</button>
                    <button onClick={()=>handleAddColumn('number')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-hashtag text-gray-400"></i>Number</button>
                    <button onClick={()=>handleAddColumn('date')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-calendar text-gray-400"></i>Date</button>
                    <button onClick={()=>handleAddColumn('formula')} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-calculator text-gray-400"></i>Formula</button>
                  </div>
                  <div className="border-t mt-2 pt-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">FROM APP SOURCES</div>
                    <button onClick={()=>importFrom('/deals')} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /deals
                    </button>
                    <button onClick={()=>importFrom('/leads')} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /leads
                    </button>
                    <button onClick={()=>importFrom('/candidates')} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /candidates
                    </button>
                    <button onClick={()=>importFrom('/campaigns')} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /campaigns
                    </button>
                    <button onClick={()=>importFrom('/jobs')} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /jobs
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={handleAddRow} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <i className="fas fa-plus text-sm"></i>Add Row
            </button>
            <button onClick={()=>importFrom('/deals')} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <i className="fas fa-upload text-sm"></i>Import Data
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"><i className="fas fa-filter"></i></button>
              <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"><i className="fas fa-sort"></i></button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <i className="fas fa-robot mr-2"></i>Ask REX
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <main id="main-grid" className="flex-1 p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div id="table-container" className="overflow-auto" style={{ height: 'calc(100vh - 200px)' }}>
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left"><input type="checkbox" className="rounded border-gray-300" /></th>
                      {schema.map((col) => (
                        <th key={col.name} className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r border-gray-200 min-w-32">
                          <div className="flex items-center gap-2">
                            {col.name}
                            {col.type === 'formula' && <i className="fas fa-calculator text-purple-400 text-xs"></i>}
                            <i className="fas fa-grip-vertical text-gray-400 cursor-move"></i>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr className="border-b border-gray-100">
                        <td colSpan={schema.length + 1} className="px-4 py-6 text-center text-gray-500">No rows yet. Import or add rows to get started.</td>
                      </tr>
                    )}
                    {rows.map((r, idx) => (
                      <tr key={idx} className={`transition-colors border-b border-gray-100 ${selectedRowIndex === idx ? 'bg-purple-50' : 'hover:bg-purple-50'}`} onClick={()=>setSelectedRowIndex(idx)}>
                        <td className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300" /></td>
                        {schema.map((col) => (
                          <td key={`${idx}-${col.name}`} className="px-4 py-3 border-r border-gray-100">
                            {String((r || {})[col.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
          <aside id="sidebar" className="w-80 bg-white border-l border-gray-200 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Column Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Column Name</label>
                    <input type="text" value={schema?.[0]?.name || ''} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Column Type</label>
                    <input value={schema?.[0]?.type || ''} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Width</label>
                    <input type="number" placeholder="200" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                  </div>
                </div>
              </div>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Row Details</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Selected: {selectedRowIndex >= 0 ? String(rows[selectedRowIndex]?.[schema?.[0]?.name] ?? 'Row') : 'None'}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" placeholder="Add notes..."></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                      <button className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors">
                        <i className="fas fa-paperclip mr-2"></i>Add files
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="User" className="w-8 h-8 rounded-full" />
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">John edited Value</div>
                      <div className="text-gray-500">2 minutes ago</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg" alt="User" className="w-8 h-8 rounded-full" />
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">Sarah added new row</div>
                      <div className="text-gray-500">5 minutes ago</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
        <footer id="footer" className="bg-white border-t border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"><i className="fas fa-download"></i>Export</button>
              <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"><i className="fas fa-undo"></i>Undo</button>
            </div>
            <div className="text-sm text-gray-500">
              {saving ? 'Saving...' : `Last saved: just now · Viewers: ${presenceCount}`}
            </div>
          </div>
        </footer>
      </div>
      {/* EXACT SOURCE END */}

      {/* Team Access Modal */}
      {showShare && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={(e)=>{ if (e.target === e.currentTarget) setShowShare(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Team Access</h3>
              <button onClick={()=>setShowShare(false)} className="text-gray-500 hover:text-gray-700"><i className="fas fa-times"></i></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Add teammate</label>
                <div className="flex items-center gap-2">
                  <select value={addingUserId} onChange={(e)=>setAddingUserId(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg">
                    <option value="">Select user</option>
                    {teamMembers.filter(m => !(collaborators||[]).some(c => String(c.user_id) === String(m.id))).map((m)=>(
                      <option key={m.id} value={m.id}>{m.full_name || m.email || m.id}</option>
                    ))}
                  </select>
                  <select value={addingRole} onChange={(e)=>setAddingRole(e.target.value)} className="px-3 py-2 border rounded-lg">
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                  </select>
                  <button onClick={()=>{
                    if (!addingUserId) return;
                    setCollaborators(prev => [...prev, { user_id: addingUserId, role: addingRole }]);
                    setAddingUserId('');
                  }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Add</button>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">People with access</div>
                <div className="divide-y border rounded-lg">
                  {(collaborators||[]).map((c, i) => {
                    const member = teamMembers.find(m => String(m.id) === String(c.user_id));
                    return (
                      <div key={`${c.user_id}-${i}`} className="flex items-center justify-between p-3">
                        <div className="min-w-0">
                          <div className="text-gray-900 font-medium truncate">{member?.full_name || member?.email || c.user_id}</div>
                          <div className="text-xs text-gray-500 truncate">{member?.email || ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select value={c.role} onChange={(e)=>{
                            const val = e.target.value === 'edit' ? 'edit' : 'view';
                            setCollaborators(prev => prev.map((x, idx) => idx===i ? { ...x, role: val } : x));
                          }} className="px-2 py-1 border rounded">
                            <option value="view">View</option>
                            <option value="edit">Edit</option>
                          </select>
                          <button onClick={()=> setCollaborators(prev => prev.filter((_, idx)=> idx!==i))} className="text-gray-500 hover:text-red-600 p-2"><i className="fas fa-trash"></i></button>
                        </div>
                      </div>
                    );
                  })}
                  {(!collaborators || collaborators.length === 0) && <div className="p-3 text-sm text-gray-500">No collaborators yet.</div>}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={()=>setShowShare(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={async()=>{
                try {
                  await apiFetch(`/api/tables/${encodeURIComponent(id)}/share`, { method: 'POST', body: JSON.stringify({ collaborators }) });
                  setShowShare(false);
                } catch (e) {
                  window.alert('Failed to save access');
                }
              }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


