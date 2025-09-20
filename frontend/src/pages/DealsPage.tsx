import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type ViewTab = 'clients' | 'opportunities' | 'billing' | 'revenue';
type ClientsSubView = 'companies' | 'decisionMakers';
type OppView = 'table' | 'pipeline';

export default function DealsPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('clients');
  const [clientsView, setClientsView] = useState<ClientsSubView>('companies');
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<{ can_view_clients: boolean; can_view_opportunities: boolean; can_view_billing: boolean; can_view_revenue: boolean } | null>(null);
  const [opps, setOpps] = useState<any[]>([]);
  const [oppLoading, setOppLoading] = useState(false);
  const [oppFilters, setOppFilters] = useState<{ status: string; client: string; search: string }>({ status: '', client: '', search: '' });
  const [oppView, setOppView] = useState<OppView>('table');
  const [board, setBoard] = useState<Array<{ stage: string; weight_percent: number; order_index: number; total: number; weighted: number; items: any[] }>>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addStage, setAddStage] = useState('Pipeline');
  const [form, setForm] = useState<{ title: string; client_id: string; value: string; billing_type: string }>({ title: '', client_id: '', value: '', billing_type: '' });

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!access?.can_view_billing) return;
      setInvLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/invoices`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = resp.ok ? await resp.json() : [];
      setInvoices(js || []);
      setInvLoading(false);
    };
    fetchInvoices();
  }, [access?.can_view_billing]);

  const BillingSection = () => (
    <div className="w-full">
      <div className="bg-white rounded-xl border p-6 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
            <input className="w-full pl-8 pr-3 py-2 bg-white border rounded-lg text-sm" placeholder="Search invoices..." />
          </div>
          <select className="border rounded-lg text-sm py-2 px-3">
            <option value="">All Statuses</option>
            <option>unbilled</option>
            <option>sent</option>
            <option>paid</option>
            <option>overdue</option>
          </select>
          <select className="border rounded-lg text-sm py-2 px-3">
            <option value="">All Billing Types</option>
            <option>contingency</option>
            <option>retainer</option>
            <option>rpo</option>
            <option>staffing</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">Create Invoice</button>
        </div>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 w-12"><input type="checkbox" /></th>
                <th className="p-4 text-left">Opportunity</th>
                <th className="p-4 text-left">Client</th>
                <th className="p-4 text-left">Billing Type</th>
                <th className="p-4 text-left">Value</th>
                <th className="p-4 text-left">Invoice Status</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invLoading ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">Loading…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500">No invoices</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="p-4"><input type="checkbox" /></td>
                    <td className="p-4">{inv.opportunity_id?.slice(0,8)}</td>
                    <td className="p-4">{inv.client_id?.slice(0,8)}</td>
                    <td className="p-4 capitalize">{inv.billing_type || '—'}</td>
                    <td className="p-4">${(Number(inv.amount)||0).toLocaleString()}</td>
                    <td className="p-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{inv.status}</span></td>
                    <td className="p-4 space-x-3"><button className="text-blue-600">View</button>{inv.status!=='paid' && <button className="text-blue-600">Send Reminder</button>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
    const run = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const userId = session?.user?.id;
      if (!token || !userId) {
        setAccess({ can_view_clients: false, can_view_opportunities: false, can_view_billing: false, can_view_revenue: false });
        setLoading(false);
        return;
      }
      try {
        const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/deal-access/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          const js = await resp.json();
          setAccess(js);
        } else {
          setAccess({ can_view_clients: false, can_view_opportunities: false, can_view_billing: false, can_view_revenue: false });
        }
      } finally { setLoading(false); }
    };
    run();
  }, []);

  useEffect(() => {
    const fetchOpps = async () => {
      if (!access?.can_view_opportunities) return;
      setOppLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (oppView === 'table') {
        const qs = new URLSearchParams();
        if (oppFilters.status) qs.set('status', oppFilters.status);
        if (oppFilters.client) qs.set('client', oppFilters.client);
        if (oppFilters.search) qs.set('search', oppFilters.search);
        const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities?${qs.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const js = resp.ok ? await resp.json() : [];
        setOpps(js || []);
      } else {
        const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunity-pipeline`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const js = resp.ok ? await resp.json() : [];
        setBoard(js || []);
      }
      setOppLoading(false);
    };
    fetchOpps();
  }, [access?.can_view_opportunities, oppFilters.status, oppFilters.client, oppFilters.search, oppView]);

  const refetchBoard = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunity-pipeline`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const js = resp.ok ? await resp.json() : [];
    setBoard(js || []);
  };

  const handleCardDragStart = (e: React.DragEvent<HTMLDivElement>, item: any, fromStage: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, from_stage: fromStage }));
  };

  const handleColumnDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleColumnDrop = async (e: React.DragEvent<HTMLDivElement>, toStage: string) => {
    try {
      const txt = e.dataTransfer.getData('text/plain');
      if (!txt) return;
      const { id, from_stage } = JSON.parse(txt || '{}');
      if (!id || from_stage === toStage) return;
      // Optimistic move
      setBoard(prev => {
        const copy = prev.map(c => ({ ...c, items: [...c.items] }));
        let moved: any | null = null;
        for (const col of copy) {
          if (col.stage === from_stage) {
            const idx = col.items.findIndex((it: any) => it.id === id);
            if (idx >= 0) { moved = { ...col.items[idx] }; col.items.splice(idx, 1); }
          }
        }
        if (moved) {
          for (const col of copy) {
            if (col.stage === toStage) { col.items.unshift({ ...moved, stage: toStage }); break; }
          }
        }
        return copy;
      });
      // Persist
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunity-pipeline/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ opportunity_id: id, to_stage: toStage })
      });
      // Refresh to recalc totals/weighted
      await refetchBoard();
    } catch {}
  };

  const openAddForStage = (stage: string) => {
    setAddStage(stage);
    setForm({ title: '', client_id: '', value: '', billing_type: '' });
    setAddOpen(true);
  };

  const submitAdd = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const payload = {
      title: form.title.trim(),
      client_id: form.client_id.trim() || null,
      value: Number(form.value) || 0,
      billing_type: form.billing_type || null,
      stage: addStage
    };
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      setAddOpen(false);
      await refetchBoard();
    }
  };

  const canSee = (tab: ViewTab) => {
    if (!access) return false;
    if (tab === 'clients') return access.can_view_clients;
    if (tab === 'opportunities') return access.can_view_opportunities;
    if (tab === 'billing') return access.can_view_billing;
    if (tab === 'revenue') return access.can_view_revenue;
    return false;
  };

  const renderAccessDenied = () => (
    <div className="p-8 text-center border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">Access not granted</h3>
      <p className="text-gray-600 text-sm">Ask your Team Admin for access to Deals.</p>
    </div>
  );

  const ClientsSection = () => (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 bg-gray-200 rounded-full p-1">
          <button onClick={() => setClientsView('companies')} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${clientsView==='companies'?'bg-white text-blue-600 shadow-sm':'bg-transparent text-gray-600'}`}>Companies</button>
          <button onClick={() => setClientsView('decisionMakers')} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${clientsView==='decisionMakers'?'bg-white text-blue-600 shadow-sm':'bg-transparent text-gray-600'}`}>Decision Makers</button>
        </div>
        <div className="flex items-center space-x-3">
          <button className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold py-2 px-4 rounded-lg">Import CSV</button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg">Add Client</button>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
          <input className="w-full pl-8 pr-3 py-2 bg-white border rounded-lg text-sm" placeholder="Search clients..." />
        </div>
        <button className="text-sm text-gray-600">Filters</button>
      </div>
      <div className="bg-white border rounded-xl">
        <div className="p-6 text-gray-600 text-sm">Table placeholder — wired in next step using existing Clients UI components.</div>
      </div>
    </div>
  );

  const currency = (n: number) => (isFinite(n as any) ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '$0');
  const totalPipeline = opps.reduce((s, o) => s + (Number(o.value) || 0), 0);

  const OpportunitiesSection = () => (
    <div className="w-full">
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-200 rounded-full p-1">
            <button onClick={() => setOppView('table')} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${oppView==='table'?'bg-white text-blue-600 shadow-sm':'text-gray-600'}`}>Table</button>
            <button onClick={() => setOppView('pipeline')} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${oppView==='pipeline'?'bg-white text-blue-600 shadow-sm':'text-gray-600'}`}>Pipeline</button>
          </div>
          <div className="relative w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
            <input value={oppFilters.search} onChange={e=>setOppFilters(p=>({ ...p, search: e.target.value }))} className="w-full pl-8 pr-3 py-2 bg-white border rounded-lg text-sm" placeholder="Search opportunities..." />
          </div>
          <select value={oppFilters.status} onChange={e=>setOppFilters(p=>({ ...p, status: e.target.value }))} className="border rounded-lg text-sm py-2 px-3">
            <option value="">All Statuses</option>
            <option>Pipeline</option>
            <option>Best Case</option>
            <option>Commit</option>
            <option>Close Won</option>
            <option>Closed Lost</option>
          </select>
          <input value={oppFilters.client} onChange={e=>setOppFilters(p=>({ ...p, client: e.target.value }))} className="border rounded-lg text-sm py-2 px-3" placeholder="Client ID" />
        </div>
        <div className="flex items-center gap-4 text-gray-700">
          {oppView==='table' ? (
            <>
              <span>📊 Total Pipeline Value:</span><span className="font-semibold">{currency(totalPipeline)}</span>
            </>
          ) : (
            <>
              <span>📊 Total:</span>
              <span className="font-semibold">{currency(board.reduce((s, col)=>s+col.total, 0))}</span>
              <span>• Weighted:</span>
              <span className="font-semibold">{currency(board.reduce((s, col)=>s+col.weighted, 0))}</span>
            </>
          )}
        </div>
      </div>
      {oppView==='table' ? (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 w-12"><input type="checkbox" /></th>
                  <th className="p-4 text-left">Opportunity Title</th>
                  <th className="p-4 text-left">Client</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-right">Value ($)</th>
                  <th className="p-4 text-left">Job REQ(s)</th>
                  <th className="p-4 text-left">Owner</th>
                  <th className="p-4 text-left">Created</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {oppLoading ? (
                  <tr><td colSpan={9} className="p-6 text-center text-gray-500">Loading…</td></tr>
                ) : opps.length === 0 ? (
                  <tr><td colSpan={9} className="p-6 text-center text-gray-500">No opportunities</td></tr>
                ) : (
                  opps.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="p-4"><input type="checkbox" /></td>
                      <td className="p-4 font-medium text-gray-900">{o.title}</td>
                      <td className="p-4"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-gray-200" /> <span className="font-medium">{o.client?.name || o.client?.domain || '—'}</span></div></td>
                      <td className="p-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{o.stage || 'Pipeline'}</span></td>
                      <td className="p-4 text-right font-medium">{currency(Number(o.value)||0)}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {(o.reqs || []).map((rid: string) => (
                            <span key={rid} className="bg-gray-100 text-xs text-gray-600 px-2 py-1 rounded-md">{rid.slice(0,6)}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="w-8 h-8 rounded-full bg-gray-200" title={`${o.owner?.first_name||''} ${o.owner?.last_name||''}`}></div>
                      </td>
                      <td className="p-4 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-right"><button className="text-blue-600 font-semibold">View Pipeline</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 overflow-x-auto">
          {oppLoading ? (
            <div className="text-gray-500">Loading…</div>
          ) : (
            board.map((col) => (
              <div key={col.stage} className="bg-gray-100 rounded-lg w-80 flex-shrink-0 flex flex-col"
                   onDragOver={handleColumnDragOver}
                   onDrop={(e)=>handleColumnDrop(e, col.stage)}>
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="bg-white text-gray-800 text-sm font-semibold px-3 py-1 rounded-full">{col.stage}</span>
                    <span className="text-sm font-medium text-gray-500">{col.items.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <button className="hover:text-gray-600" onClick={()=>openAddForStage(col.stage)}>＋</button>
                  </div>
                </div>
                <div className="p-2 flex-grow">
                  {col.items.map((it) => (
                    <div key={it.id} className="bg-white shadow-sm rounded-lg p-4 mb-3 border border-gray-200"
                         draggable
                         onDragStart={(e)=>handleCardDragStart(e, it, col.stage)}>
                      <div className="font-semibold text-sm mb-1 text-gray-800">{it.title}</div>
                      <div className="text-xs text-gray-500 mb-2">{(it.client?.name || it.client?.domain || '—')} • {currency(Number(it.value)||0)}</div>
                      <div className="flex items-center justify-between">
                        <div className="w-6 h-6 rounded-full bg-gray-200" />
                        <span className="text-xs text-gray-400">{new Date(it.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-200 mt-auto">
                  <p className="text-sm font-semibold text-gray-600">Total: {currency(col.total)}</p>
                  <p className="text-xs font-medium text-gray-400 mt-1">Weighted ({col.weight_percent}%): {currency(col.weighted)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const AddModal = () => !addOpen ? null : (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Add Opportunity</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Title</label>
            <input value={form.title} onChange={e=>setForm(p=>({ ...p, title: e.target.value }))} className="w-full border rounded-md px-3 py-2" placeholder="Opportunity title" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Client ID</label>
            <input value={form.client_id} onChange={e=>setForm(p=>({ ...p, client_id: e.target.value }))} className="w-full border rounded-md px-3 py-2" placeholder="UUID of client" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Value (USD)</label>
              <input value={form.value} onChange={e=>setForm(p=>({ ...p, value: e.target.value }))} className="w-full border rounded-md px-3 py-2" placeholder="e.g. 50000" />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Billing Type</label>
              <input value={form.billing_type} onChange={e=>setForm(p=>({ ...p, billing_type: e.target.value }))} className="w-full border rounded-md px-3 py-2" placeholder="retainer / contingency" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Stage</label>
            <input value={addStage} onChange={e=>setAddStage(e.target.value)} className="w-full border rounded-md px-3 py-2" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-md border" onClick={()=>setAddOpen(false)}>Cancel</button>
          <button className="px-4 py-2 rounded-md bg-blue-600 text-white" onClick={submitAdd}>Create</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Deals</h1>
      <div className="flex items-center space-x-2 bg-gray-200 rounded-full p-1 mb-6">
        <button onClick={() => setActiveTab('clients')} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${activeTab==='clients'?'bg-white text-blue-600 shadow-sm':'text-gray-600'}`}>Clients</button>
        <button onClick={() => setActiveTab('opportunities')} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${activeTab==='opportunities'?'bg-white text-blue-600 shadow-sm':'text-gray-600'}`}>Opportunities</button>
        <button onClick={() => setActiveTab('billing')} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${activeTab==='billing'?'bg-white text-blue-600 shadow-sm':'text-gray-600'}`}>Billing</button>
        <button onClick={() => setActiveTab('revenue')} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${activeTab==='revenue'?'bg-white text-blue-600 shadow-sm':'text-gray-600'}`}>Revenue</button>
      </div>
      {loading ? (
        <div className="animate-pulse text-gray-500">Loading…</div>
      ) : (
        <>
          {activeTab==='clients' && (canSee('clients') ? <ClientsSection /> : renderAccessDenied())}
          {activeTab==='opportunities' && (canSee('opportunities') ? <><OpportunitiesSection /><AddModal /></> : renderAccessDenied())}
          {activeTab==='billing' && (canSee('billing') ? <BillingSection /> : renderAccessDenied())}
          {activeTab==='revenue' && (canSee('revenue') ? <div /> : renderAccessDenied())}
        </>
      )}
    </div>
  );
}


