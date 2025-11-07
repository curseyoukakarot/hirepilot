import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function TableEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tableName, setTableName] = useState('Deals Tracker Table');
  const [saving, setSaving] = useState(false);
  const [presenceCount, setPresenceCount] = useState(1);

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
        if (data?.name) setTableName(String(data.name));
      } catch {}
    };
    load();
  }, [id]);

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
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const onImportDeals = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await apiFetch(`/api/tables/${encodeURIComponent(id)}/import`, {
        method: 'POST',
        body: JSON.stringify({ source: '/deals' }),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
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
              <input type="text" value={tableName} onChange={(e)=>setTableName(e.target.value)} className="text-2xl font-semibold text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1" />
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors">
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
              <button id="add-column-btn" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-plus text-sm"></i>
                Add Column
                <i className="fas fa-chevron-down text-xs"></i>
              </button>
              <div id="column-dropdown" className="hidden absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">COLUMN TYPES</div>
                  <div className="space-y-1">
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-font text-gray-400"></i>Text</button>
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-circle text-purple-400"></i>Status</button>
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-hashtag text-gray-400"></i>Number</button>
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-calendar text-gray-400"></i>Date</button>
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"><i className="fas fa-calculator text-gray-400"></i>Formula</button>
                  </div>
                  <div className="border-t mt-2 pt-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">FROM APP SOURCES</div>
                    <button onClick={onImportDeals} className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 text-purple-600 flex items-center gap-2">
                      <i className="fas fa-database text-purple-400"></i>Import from /deals
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <i className="fas fa-plus text-sm"></i>Add Row
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
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
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r border-gray-200 min-w-48"><div className="flex items-center gap-2">Deal Title<i className="fas fa-grip-vertical text-gray-400 cursor-move"></i></div></th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r border-gray-200 min-w-32"><div className="flex items-center gap-2">Value<i className="fas fa-grip-vertical text-gray-400 cursor-move"></i></div></th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-r border-gray-200 min-w-32"><div className="flex items-center gap-2">Status<i className="fas fa-grip-vertical text-gray-400 cursor-move"></i></div></th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-32"><div className="flex items-center gap-2">Projected<i className="fas fa-calculator text-purple-400 text-xs"></i><i className="fas fa-grip-vertical text-gray-400 cursor-move"></i></div></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-purple-50 transition-colors border-b border-gray-100">
                      <td className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><input type="text" defaultValue="Enterprise Exec Search" className="w-full bg-transparent border-none outline-none focus:bg-white focus:border focus:border-purple-300 rounded px-2 py-1" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><input type="text" defaultValue="$20,000" className="w-full bg-transparent border-none outline-none focus:bg-white focus:border focus:border-purple-300 rounded px-2 py-1" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 cursor-pointer hover:bg-orange-200 transition-colors">Commit</span></td>
                      <td className="px-4 py-3 text-gray-600">$18,000</td>
                    </tr>
                    <tr className="hover:bg-purple-50 transition-colors border-b border-gray-100">
                      <td className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><input type="text" defaultValue="VP Sales Regional" className="w-full bg-transparent border-none outline-none focus:bg-white focus:border focus:border-purple-300 rounded px-2 py-1" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><input type="text" defaultValue="$35,000" className="w-full bg-transparent border-none outline-none focus:bg-white focus:border focus:border-purple-300 rounded px-2 py-1" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors">Open</span></td>
                      <td className="px-4 py-3 text-gray-600">$31,500</td>
                    </tr>
                    <tr className="hover:bg-purple-50 transition-colors border-b border-gray-100">
                      <td className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><input type="text" defaultValue="Director Marketing" className="w-full bg-transparent border-none outline-none focus:bg-white focus:border focus:border-purple-300 rounded px-2 py-1" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><input type="text" defaultValue="$28,000" className="w-full bg-transparent border-none outline-none focus:bg-white focus:border focus:border-purple-300 rounded px-2 py-1" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 cursor-pointer hover:bg-green-200 transition-colors">Hired</span></td>
                      <td className="px-4 py-3 text-gray-600">$25,200</td>
                    </tr>
                    <tr className="hover:bg-purple-50 transition-colors border-b border-gray-100">
                      <td className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><input type="text" defaultValue="Senior Developer" className="w-full bg-transparent border-none outline-none focus:bg-white focus:border focus:border-purple-300 rounded px-2 py-1" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><input type="text" defaultValue="$15,000" className="w-full bg-transparent border-none outline-none focus:bg-white focus:border focus:border-purple-300 rounded px-2 py-1" /></td>
                      <td className="px-4 py-3 border-r border-gray-100"><span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200 transition-colors">Draft</span></td>
                      <td className="px-4 py-3 text-gray-600">$13,500</td>
                    </tr>
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
                    <input type="text" defaultValue="Deal Title" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Column Type</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                      <option>Text</option>
                      <option>Number</option>
                      <option>Status</option>
                      <option>Date</option>
                      <option>Formula</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Width</label>
                    <input type="number" defaultValue="200" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                  </div>
                </div>
              </div>
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Row Details</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">Selected: Enterprise Exec Search</div>
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
    </div>
  );
}


