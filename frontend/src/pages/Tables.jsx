import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Tables() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const apiFetch = async (url, init = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = { 'Content-Type': 'application/json', ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const resp = await fetch(url, { ...init, headers, credentials: 'include' });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  };

  const createAndOpenEditor = async () => {
    try {
      const payload = {
        name: 'Untitled Table',
        schema_json: [],
        initial_data: [],
      };
      // Direct Supabase insert (avoid Vercel routes entirely)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('unauthenticated');
      const { data: inserted, error } = await supabase
        .from('custom_tables')
        .insert({ user_id: user.id, name: payload.name, schema_json: payload.schema_json, data_json: payload.initial_data })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      if (inserted?.id) navigate(`/tables/${inserted.id}/edit`);
    } catch {
      // fallback: just navigate to editor without id (no-op)
      navigate('/tables/new/edit');
    }
  };

  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    if (qp.get('create') === '1') {
      createAndOpenEditor();
    }
  }, [location.search]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Prefer direct Supabase to avoid Vercel 405s in production
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: rows } = await supabase
            .from('custom_tables')
            .select('*')
            .order('updated_at', { ascending: false });
          setTables(Array.isArray(rows) ? rows : []);
        }
      } catch {
        // Final fallback: empty
        setTables([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const numberFmt = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const toCSV = (rows) => {
    const arr = Array.isArray(rows) ? rows : [];
    const headers = Array.from(new Set(arr.flatMap(r => Object.keys(r || {}))));
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(','), ...arr.map(r => headers.map(h => escape((r||{})[h])).join(','))];
    return lines.join('\n');
  };

  const exportTable = (t) => {
    try {
      const csv = toCSV(t?.data_json || []);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(t?.name||'table').replace(/[^a-z0-9_\-]+/gi,'_')}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch {}
  };

  const deleteTable = async (id) => {
    if (!id) return;
    const ok = window.confirm('Delete this table? This cannot be undone.');
    if (!ok) return;
    try {
      await supabase.from('custom_tables').delete().eq('id', id);
      setTables(prev => prev.filter(t => t.id !== id));
    } catch {}
  };

  return (
    <div className="bg-neutral min-h-screen">
      {/* EXACT SOURCE START (layout/content preserved as-is) */}
      <div id="main-content" className="min-h-screen">
        <header id="header" className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Custom Tables</h1>
              <p className="text-gray-600 mt-1">Build and manage recruiting data—import from sources, use REX, or manual entry.</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input type="text" placeholder="Search tables..." className="w-80 px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                <i className="fas fa-search absolute right-3 top-3 text-gray-400"></i>
              </div>
              <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="Avatar" className="w-10 h-10 rounded-full" />
            </div>
          </div>
        </header>

        <main id="tables-main" className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Dynamic user tables */}
            {!loading && tables.map((t) => {
              const cols = Array.isArray(t.schema_json) ? t.schema_json.length : 0;
              const rows = Array.isArray(t.data_json) ? t.data_json.length : 0;
              const previewCols = (Array.isArray(t.schema_json) ? t.schema_json : []).slice(0,3);
              const previewRows = (Array.isArray(t.data_json) ? t.data_json : []).slice(0,3);
              return (
                <div key={t.id} className="bg-white rounded-lg shadow-md p-6 table-card-hover transition-all duration-300 relative">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{t.name || 'Untitled Table'}</h3>
                    <div className="relative">
                      <button className="text-gray-400 hover:text-gray-600" onClick={()=> setMenuOpenId(menuOpenId===t.id?null:t.id)}>
                        <i className="fas fa-ellipsis-h"></i>
                      </button>
                      {menuOpenId===t.id && (
                        <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 w-36">
                          <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 text-sm" onClick={()=>navigate(`/tables/${t.id}/edit`)}>Edit</button>
                          <button className="w-full text-left px-3 py-2 rounded hover:bg-red-50 text-sm text-red-600" onClick={()=>deleteTable(t.id)}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mini dynamic preview */}
                  {previewCols.length>0 && (
                    <div className="overflow-hidden rounded-lg border border-gray-200 mb-4">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {previewCols.map(c => (
                              <th key={c.name} className="px-3 py-2 text-left font-medium text-gray-700">{c.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((r, i) => (
                            <tr key={i} className="border-t">
                              {previewCols.map(c => {
                                const v = (r || {})[c.name];
                                if (c.type === 'money') {
                                  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: (c && c.currency) ? c.currency : 'USD' });
                                  return <td key={c.name} className="px-3 py-2 text-gray-900">{fmt.format(Number(v) || 0)}</td>;
                                }
                                if (c.type === 'number') return <td key={c.name} className="px-3 py-2 text-gray-900">{numberFmt.format(Number(v) || 0)}</td>;
                                if (c.type === 'status') return <td key={c.name} className="px-3 py-2"><span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{String(v || '')}</span></td>;
                                return <td key={c.name} className="px-3 py-2 text-gray-900">{String(v || '')}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-2 text-sm text-gray-500">
                    <div>{rows} rows • {cols} columns</div>
                    <div>{t.updated_at ? `Last edited ${new Date(t.updated_at).toLocaleString()}` : ''}</div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => navigate(`/tables/${t.id}/edit`)} className="flex-1 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">Edit</button>
                    <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50" onClick={()=>navigate(`/tables/${t.id}/edit?share=1`)}>Share</button>
                    <button onClick={()=>exportTable(t)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Export</button>
                  </div>
                </div>
              );
            })}

            <div id="create-table-card" className="bg-gradient-to-br from-purple-50 to-white rounded-lg border-2 border-dashed border-purple-300 p-6 flex flex-col items-center justify-center text-center min-h-[400px] hover:border-purple-400 transition-colors cursor-pointer">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-plus text-white text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Create New Table</h3>
              <p className="text-gray-600 mb-4">Start building your custom recruiting data table</p>
              <button className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700" onClick={createAndOpenEditor}>
                Get Started
              </button>
            </div>
          </div>
        </main>
      </div>

      <button id="floating-create-btn" onClick={createAndOpenEditor} className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-purple-700 hover:scale-110 transition-all duration-300 flex items-center justify-center z-50">
        <i className="fas fa-plus text-xl"></i>
      </button>
      {/* EXACT SOURCE END */}
    </div>
  );
}


