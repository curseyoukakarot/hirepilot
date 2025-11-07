import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Tables() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

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
              return (
                <div key={t.id} className="bg-white rounded-lg shadow-md p-6 table-card-hover transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{t.name || 'Untitled Table'}</h3>
                    <button className="text-gray-400 hover:text-gray-600"><i className="fas fa-ellipsis-h"></i></button>
                  </div>
                  <div className="text-sm text-gray-500 mb-4">{rows} rows • {cols} columns</div>
                  <div className="flex space-x-2">
                    <button onClick={() => navigate(`/tables/${t.id}/edit`)} className="flex-1 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">Edit</button>
                    <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Share</button>
                    <button onClick={() => navigate(`/api/tables/${t.id}/export?format=csv`)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Export</button>
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


