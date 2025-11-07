import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Tables() {
  const navigate = useNavigate();
  const location = useLocation();

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
        schema_json: [
          { name: 'Deal Title', type: 'text' },
          { name: 'Value', type: 'number' },
          { name: 'Status', type: 'status' },
          { name: 'Projected', type: 'formula', formula: '=Value*0.9' }
        ],
        initial_data: [
          { 'Deal Title': 'Enterprise Exec', 'Value': 20000, 'Status': 'Commit' },
          { 'Deal Title': 'Tech Director', 'Value': 15000, 'Status': 'Pipeline' },
          { 'Deal Title': 'Sales Manager', 'Value': 12000, 'Status': 'Won' }
        ],
      };
      const { data } = await apiFetch('/api/tables', { method: 'POST', body: JSON.stringify(payload) });
      if (data?.id) navigate(`/tables/${data.id}/edit`);
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
            {/* Preserved example cards */}
            <div id="deals-table-card" className="bg-white rounded-lg shadow-md p-6 table-card-hover transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Q4 Deals Tracker</h3>
                <div className="flex space-x-2">
                  <button className="text-gray-400 hover:text-gray-600"><i className="fas fa-share-alt"></i></button>
                  <button className="text-gray-400 hover:text-gray-600"><i className="fas fa-ellipsis-h"></i></button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Deal</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Value</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Enterprise Exec</td>
                      <td className="px-3 py-2 text-gray-900">$20,000</td>
                      <td className="px-3 py-2"><span className="status-commit px-2 py-1 rounded-full text-xs font-medium">Commit</span></td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Tech Director</td>
                      <td className="px-3 py-2 text-gray-900">$15,000</td>
                      <td className="px-3 py-2"><span className="status-pipeline px-2 py-1 rounded-full text-xs font-medium">Pipeline</span></td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Sales Manager</td>
                      <td className="px-3 py-2 text-gray-900">$12,000</td>
                      <td className="px-3 py-2"><span className="status-won px-2 py-1 rounded-full text-xs font-medium">Won</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500"><span className="font-medium">12 rows</span> • <span className="font-medium">5 columns</span></div>
                <div className="text-sm text-gray-500">Last edited 2 hours ago</div>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700" onClick={createAndOpenEditor}>Edit</button>
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Share</button>
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Export</button>
              </div>
            </div>

            <div id="jobs-table-card" className="bg-white rounded-lg shadow-md p-6 table-card-hover transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Active Job Reqs</h3>
                <div className="flex space-x-2">
                  <button className="text-gray-400 hover:text-gray-600"><i className="fas fa-share-alt"></i></button>
                  <button className="text-gray-400 hover:text-gray-600"><i className="fas fa-ellipsis-h"></i></button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Position</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Candidates</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Regional VP Sales</td>
                      <td className="px-3 py-2 text-gray-900">8</td>
                      <td className="px-3 py-2"><span className="status-open px-2 py-1 rounded-full text-xs font-medium">Open</span></td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Product Manager</td>
                      <td className="px-3 py-2 text-gray-900">12</td>
                      <td className="px-3 py-2"><span className="status-open px-2 py-1 rounded-full text-xs font-medium">Open</span></td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Senior Engineer</td>
                      <td className="px-3 py-2 text-gray-900">5</td>
                      <td className="px-3 py-2"><span className="status-draft px-2 py-1 rounded-full text-xs font-medium">Draft</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500"><span className="font-medium">8 rows</span> • <span className="font-medium">6 columns</span></div>
                <div className="text-sm text-gray-500">Last edited 1 day ago</div>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700" onClick={createAndOpenEditor}>Edit</button>
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Share</button>
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Export</button>
              </div>
            </div>

            <div id="outreach-table-card" className="bg-white rounded-lg shadow-md p-6 table-card-hover transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Outreach Campaigns</h3>
                <div className="flex space-x-2">
                  <button className="text-gray-400 hover:text-gray-600"><i className="fas fa-share-alt"></i></button>
                  <button className="text-gray-400 hover:text-gray-600"><i className="fas fa-ellipsis-h"></i></button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Campaign</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Sent</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Recruiter Owners</td>
                      <td className="px-3 py-2 text-gray-900">500</td>
                      <td className="px-3 py-2 text-green-600 font-medium">10%</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Tech Talent</td>
                      <td className="px-3 py-2 text-gray-900">320</td>
                      <td className="px-3 py-2 text-green-600 font-medium">15%</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-gray-900">Sales Leaders</td>
                      <td className="px-3 py-2 text-gray-900">280</td>
                      <td className="px-3 py-2 text-green-600 font-medium">8%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500"><span className="font-medium">15 rows</span> • <span className="font-medium">4 columns</span></div>
                <div className="text-sm text-gray-500">Last edited 3 hours ago</div>
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700" onClick={createAndOpenEditor}>Edit</button>
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Share</button>
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Export</button>
              </div>
            </div>

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


