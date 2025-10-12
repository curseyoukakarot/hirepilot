import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ClientRowEditor from '../components/deals/ClientRowEditor';
import AddOpportunityModal from '../components/deals/AddOpportunityModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CreateInvoiceModal from '../components/deals/CreateInvoiceModal';
import { PieChart, Pie, Cell } from 'recharts';
import DealLogActivityModal from '../components/deals/DealLogActivityModal';
import DealsActivityList from '../components/deals/DealsActivityList';
import ClientActivities from '../components/deals/ClientActivities';

type ViewTab = 'clients' | 'opportunities' | 'billing' | 'revenue';
type ClientsSubView = 'companies' | 'decisionMakers';
type OppView = 'table' | 'pipeline';

export default function DealsPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('clients');
  const [clientsView, setClientsView] = useState<ClientsSubView>('companies');
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<{ can_view_clients: boolean; can_view_opportunities: boolean; can_view_billing: boolean; can_view_revenue: boolean } | null>(null);
  const [opps, setOpps] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsSearch, setClientsSearch] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState<any>({});
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<any>({});
  const [oppLoading, setOppLoading] = useState(false);
  const [oppFilters, setOppFilters] = useState<{ status: string; client: string; search: string }>({ status: '', client: '', search: '' });
  const [oppView, setOppView] = useState<OppView>('table');
  const [board, setBoard] = useState<Array<{ stage: string; weight_percent: number; order_index: number; total: number; weighted: number; items: any[] }>>([]);
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [revSummary, setRevSummary] = useState<{ total_paid: number; forecasted: number; overdue: number; unpaid: number } | null>(null);
  const [revMonthly, setRevMonthly] = useState<Array<{ month: string; paid: number; forecasted: number; outstanding: number }>>([]);
  const [revMonthlyProjected, setRevMonthlyProjected] = useState<Array<{ month: string; paid: number; forecasted: number; outstanding: number }>>([]);
  const [revMonthlyMode, setRevMonthlyMode] = useState<'actual'|'projected'>('actual');
  const [revMonthlyRange, setRevMonthlyRange] = useState<'90d'|'6m'|'1y'|'ytd'>('1y');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('');
  const [revByClient, setRevByClient] = useState<Array<{ client_id: string; client_name: string; total: number; paid: number; unpaid: number }>>([]);
  const [revByType, setRevByType] = useState<Array<{ type: string; total: number }>>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceBillingType, setInvoiceBillingType] = useState<'contingency'|'retainer'|'rpo'|'staffing'>('contingency');
  const [invoiceFields, setInvoiceFields] = useState<any>({ salary: '', percent: '20', flat_fee: '', monthly: '', hours: '', hourly_rate: '' });
  // Removed focus/selection refs per engineer's plan
  const [invoiceRecipient, setInvoiceRecipient] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceOpportunityId, setInvoiceOpportunityId] = useState<string>('');
  const [availableOpps, setAvailableOpps] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addStage, setAddStage] = useState('Pipeline');
  const [form, setForm] = useState<{ title: string; client_id: string; value: string; billing_type: string }>({ title: '', client_id: '', value: '', billing_type: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [logModal, setLogModal] = useState<{ type: 'client'|'decision_maker'|'opportunity'; id: string } | null>(null);
  // Removed modal caret refs

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          setCurrentUserAvatar(user.user_metadata?.avatar_url || '');
        }
      } catch {}
    })();
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

  useEffect(() => {
    const fetchClients = async () => {
      if (!access?.can_view_clients || activeTab !== 'clients') return;
      setClientsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = resp.ok ? await resp.json() : [];
      setClients(js || []);
      setClientsLoading(false);
    };
    fetchClients();
  }, [access?.can_view_clients, activeTab]);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!access?.can_view_clients || activeTab !== 'clients' || clientsView !== 'decisionMakers') return;
      setContactsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/contacts`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = resp.ok ? await resp.json() : [];
      setContacts(js || []);
      setContactsLoading(false);
    };
    fetchContacts();
  }, [access?.can_view_clients, activeTab, clientsView]);

  const saveClientEdits = async (id: string) => {
    const payload: any = {};
    ['name','domain','industry','revenue','location','stage','notes'].forEach(k => {
      if (clientDraft[k] !== undefined) payload[k] = clientDraft[k];
    });
    if (Object.keys(payload).length === 0) { setEditingClientId(null); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    setEditingClientId(null);
    setClientDraft({});
    // refresh
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const js = resp.ok ? await resp.json() : [];
    setClients(js || []);
  };

  const beginEditClient = (client: any) => {
    setEditingClientId(client.id);
    setClientDraft({
      name: client.name || '',
      domain: client.domain || '',
      industry: client.industry || '',
      location: client.location || '',
      stage: String(client.stage || 'prospect'),
      notes: client.notes || ''
    });
  };

  // Removed caret/selection preservation effects per engineer guidance

  const syncClientFromEnrichment = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    // Send optional hints to improve matching
    const current = clients.find((c:any)=>c.id===id);
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients/${id}/sync-enrichment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ override: false, name: current?.name || null, domain: current?.domain || null })
    });
    if (resp.ok) {
      const refreshed = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = refreshed.ok ? await refreshed.json() : [];
      setClients(js || []);
    } else {
      // Surface brief error toast in UI console for now
      try { const e = await resp.json(); console.warn('Sync enrichment failed', e); } catch {}
    }
  };

  const updateClientStage = async (id: string, stage: 'prospect' | 'active') => {
    try {
      setSavingStageId(id);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ stage })
      });
      if (!resp.ok) throw new Error('Failed to update stage');
      setClients(prev => prev.map((c: any) => (c.id === id ? { ...c, stage } : c)));
    } catch (e) {
      // no-op; UI will remain unchanged on failure
    } finally { setSavingStageId(null); }
  };

  const saveContactEdits = async (id: string) => {
    const payload: any = {};
    ['name','title','email','phone'].forEach(k => { if (contactDraft[k] !== undefined) payload[k] = contactDraft[k]; });
    if (Object.keys(payload).length === 0) { setEditingContactId(null); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      setEditingContactId(null);
      setContactDraft({});
      // refresh contacts
      const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/contacts`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = r.ok ? await r.json() : [];
      setContacts(js || []);
    }
  };

  useEffect(() => {
    const fetchRevenue = async () => {
      if (!access?.can_view_revenue) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const [sRes, mRes, cRes, pcRes, etRes, mpRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/revenue/summary`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/revenue/monthly`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/revenue/by-client`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/revenue/projected-by-client`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/revenue/engagement-types`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/revenue/monthly-projected`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ]);
      setRevSummary(sRes.ok ? await sRes.json() : null);
      const monthly = mRes.ok ? await mRes.json() : [];
      const monthlyProj = mpRes.ok ? await mpRes.json() : [];
      setRevMonthly(monthly);
      setRevMonthlyProjected(monthlyProj);
      setRevByClient(cRes.ok ? await cRes.json() : []);
      const projClients = pcRes.ok ? await pcRes.json() : [];
      setRevByClient(prev => (prev && prev.length ? prev : projClients));
      setRevByType(etRes.ok ? await etRes.json() : []);

      // Auto-toggle to Projected if no actuals exist but projected has data
      const sum = (rows: any[]) => rows.reduce((s, r) => s + (Number(r.paid||0)+Number(r.forecasted||0)+Number(r.outstanding||0)), 0);
      if (sum(monthly) === 0 && sum(monthlyProj) > 0) {
        setRevMonthlyMode('projected');
      }
    };
    fetchRevenue();
  }, [access?.can_view_revenue]);

  const openInvoiceModal = async (opportunityId?: string, billingType?: 'contingency'|'retainer'|'rpo'|'staffing') => {
    // Load minimal opportunities list for selector
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const js = resp.ok ? await resp.json() : [];
      setAvailableOpps((js || []).map((o: any) => ({ id: o.id, title: o.title, client: o.client }))); 
    } catch {}
    setInvoiceOpportunityId(opportunityId || '');
    setInvoiceBillingType(billingType || 'contingency');
    setInvoiceFields({ salary: '', percent: '20', flat_fee: '', monthly: '', hours: '', hourly_rate: '' });
    setInvoiceRecipient('');
    setInvoiceNotes('');
    setInvoiceOpen(true);
  };

  const computedInvoiceTotal = (): number => {
    const bt = invoiceBillingType;
    if (bt === 'contingency') {
      const salary = Number(String(invoiceFields.salary || '').replace(/[^0-9.]/g,'')) || 0;
      const pct = Number(invoiceFields.percent || 20);
      return Math.max(0, Math.round(salary * (pct/100)));
    }
    if (bt === 'retainer') {
      return Math.max(0, Number(String(invoiceFields.flat_fee || '').replace(/[^0-9.]/g,'')) || 0);
    }
    if (bt === 'rpo') {
      return Math.max(0, Number(String(invoiceFields.monthly || '').replace(/[^0-9.]/g,'')) || 0);
    }
    if (bt === 'staffing') {
      const hrs = Number(invoiceFields.hours || 0);
      const rate = Number(invoiceFields.hourly_rate || 0);
      return Math.max(0, Math.round(hrs * rate));
    }
    return 0;
  };

  const submitInvoice = async () => {
    setInvoiceSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const payload: any = {
        opportunity_id: invoiceOpportunityId,
        billing_type: invoiceBillingType,
        fields: invoiceFields,
        recipient_email: invoiceRecipient || undefined,
        notes: invoiceNotes || undefined
      };
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/invoices/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        setInvoiceOpen(false);
        // refresh invoices list
        const list = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/invoices`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const js = list.ok ? await list.json() : [];
        setInvoices(js || []);
      }
    } finally { setInvoiceSubmitting(false); }
  };

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
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg" onClick={()=>openInvoiceModal()}>Create Invoice</button>
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
                    <td className="p-4 space-x-3">
                      <button className="text-blue-600" onClick={()=>openInvoiceModal(inv.opportunity_id, (inv.billing_type||'contingency'))}>Bill Now</button>
                      <button className="text-blue-600">View</button>
                      {inv.status!=='paid' && <button className="text-blue-600">Send Reminder</button>}
                      <button className="text-red-600" onClick={async ()=>{
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/invoices/${inv.id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
                        const list = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/invoices`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                        const js = list.ok ? await list.json() : [];
                        setInvoices(js || []);
                      }}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  const filteredClients = useMemo(() => {
    const q = clientsSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c: any) => (
      String(c.name || '').toLowerCase().includes(q) || String(c.domain || '').toLowerCase().includes(q) || String(c.industry || '').toLowerCase().includes(q) || String(c.location || '').toLowerCase().includes(q)
    ));
  }, [clients, clientsSearch]);

  const getClientLogo = (c: any): string | null => {
    const org = c?.org_meta?.apollo?.organization || c?.org_meta?.apollo || {};
    const logo = org?.logo_url || org?.logo || null;
    if (logo) return logo;
    const domain = c?.domain || org?.website_url || org?.domain || null;
    return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : null;
  };

  const clientsLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    (clients || []).forEach((c: any) => {
      const u = getClientLogo(c);
      if (u) map.set(String(c.id), u);
    });
    return map;
  }, [clients]);
  useEffect(() => {
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
      <p className="text-gray-600 text-sm">Deals is available on paid plans. Upgrade your plan or ask your Team Admin for access.</p>
    </div>
  );

  const confirmDelete = async (type: 'client'|'contact', id: string) => {
    try {
      const label = type === 'client' ? 'client' : 'contact';
      if (!window.confirm(`This will permanently delete this ${label} from the system. Continue?`)) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const url = type === 'client' ? `${import.meta.env.VITE_BACKEND_URL}/api/clients/${id}` : `${import.meta.env.VITE_BACKEND_URL}/api/contacts/${id}`;
      const resp = await fetch(url, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (resp.ok) {
        if (type==='client') {
          const refreshed = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          const js = refreshed.ok ? await refreshed.json() : [];
          setClients(js || []);
        } else {
          const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/contacts`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          const js = r.ok ? await r.json() : [];
          setContacts(js || []);
        }
      }
    } catch {}
  };

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
          <input value={clientsSearch} onChange={e=>setClientsSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white border rounded-lg text-sm" placeholder="Search clients..." />
        </div>
        <button className="text-sm text-gray-600">Filters</button>
      </div>
      {clientsView === 'decisionMakers' ? (
        <div className="bg-white border rounded-xl overflow-hidden">
          {contactsLoading ? (
            <div className="p-6 text-gray-500 text-sm">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left w-8"><input type="checkbox" onChange={(e)=>{
                      if (e.target.checked) setSelectedContactIds(new Set(contacts.map((d:any)=>d.id)));
                      else setSelectedContactIds(new Set());
                    }} /></th>
                    <th className="p-4 text-left">Name</th>
                    <th className="p-4 text-left">Title</th>
                    <th className="p-4 text-left">Email</th>
                    <th className="p-4 text-left">Client</th>
                    <th className="p-4 text-left">Owner</th>
                    <th className="p-4 text-left">Created</th>
                    <th className="p-4 text-left w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-gray-500">No decision makers yet</td></tr>
                  ) : contacts.map((dm: any) => {
                    const client = clients.find((c: any) => c.id === dm.client_id);
                    return (
                      <tr key={dm.id} className="hover:bg-gray-50">
                        <td className="p-4 w-8"><input type="checkbox" checked={selectedContactIds.has(dm.id)} onChange={(e)=>{
                          const next = new Set(selectedContactIds);
                          if (e.target.checked) next.add(dm.id); else next.delete(dm.id);
                          setSelectedContactIds(next);
                        }} /></td>
                        <td className="p-4 font-medium text-gray-900">
                          {editingContactId === dm.id ? (
                            <input className="border rounded px-2 py-1 w-full" defaultValue={dm.name || ''} onChange={(e)=>setContactDraft((s:any)=>({ ...s, name: e.target.value }))} />
                          ) : (dm.name || '—')}
                        </td>
                        <td className="p-4">
                          {editingContactId === dm.id ? (
                            <input className="border rounded px-2 py-1 w-full" defaultValue={dm.title || ''} onChange={(e)=>setContactDraft((s:any)=>({ ...s, title: e.target.value }))} />
                          ) : (dm.title || '—')}
                        </td>
                        <td className="p-4">
                          {editingContactId === dm.id ? (
                            <input className="border rounded px-2 py-1 w-full" defaultValue={dm.email || ''} onChange={(e)=>setContactDraft((s:any)=>({ ...s, email: e.target.value }))} />
                          ) : (dm.email || '—')}
                        </td>
                        <td className="p-4">{client?.name || '—'}</td>
                        <td className="p-4">{dm.owner_id ? dm.owner_id.slice(0,6) : '—'}</td>
                        <td className="p-4 text-gray-500 flex items-center gap-2">
                          <span>{dm.created_at ? new Date(dm.created_at).toLocaleDateString() : '—'}</span>
                          {editingContactId === dm.id ? (
                            <>
                              <button className="px-2 py-1 text-xs bg-gray-200 rounded" onClick={()=>saveContactEdits(dm.id)}>Save</button>
                              <button className="px-2 py-1 text-xs" onClick={()=>{ setEditingContactId(null); setContactDraft({}); }}>Cancel</button>
                            </>
                          ) : (
                            <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={()=>{ setEditingContactId(dm.id); setContactDraft({}); }}>Edit</button>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button className="px-2 py-1 text-xs bg-gray-100 rounded" onClick={()=> setLogModal({ type:'decision_maker', id: dm.id })}>Log</button>
                            <button title="Delete" onClick={()=>confirmDelete('contact', dm.id)} className="text-red-500 hover:text-red-600">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
        {clientsLoading ? (
          <div className="p-6 text-gray-500 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-left">Company</th>
                  <th className="p-4 text-left">Logo</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Industry</th>
                  <th className="p-4 text-left">Revenue</th>
                  <th className="p-4 text-left">Location</th>
                  <th className="p-4 text-left">Decision Makers</th>
                  <th className="p-4 text-left">Created</th>
                  <th className="p-4 text-left w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredClients.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-gray-500">No clients yet</td></tr>
                ) : filteredClients.map((c: any) => (
                  <React.Fragment key={c.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={(e)=>{
                        // Do not toggle when interacting with inputs/controls or while editing this client
                        if (editingClientId === c.id) return;
                        const target = e.target as HTMLElement;
                        if (target.closest('input, textarea, select, button, a, [data-no-row-toggle]')) return;
                        setExpandedClientId(prev => prev===c.id? null : c.id);
                      }}
                    >
                      <td className="p-4 font-medium text-gray-900">{c.name || c.domain || '—'}</td>
                      <td className="p-4">
                        {(() => { const u = getClientLogo(c); return u ? <img src={u} alt="logo" className="w-6 h-6 rounded" /> : <div className="w-6 h-6 rounded bg-gray-200" />; })()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${String(c.stage).toLowerCase()==='active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{String(c.stage).toLowerCase()==='active' ? 'Active' : 'Prospect'}</span>
                          <select
                            className="border rounded px-1 py-0.5 text-xs text-gray-700"
                            value={String(c.stage || 'prospect')}
                            onChange={(e)=>updateClientStage(c.id, e.target.value === 'active' ? 'active' : 'prospect')}
                            disabled={savingStageId===c.id}
                          >
                            <option value="prospect">Prospect</option>
                            <option value="active">Active</option>
                          </select>
                        </div>
                      </td>
                      <td className="p-4">{c.industry || '—'}</td>
                      <td className="p-4">{c.revenue != null ? Number(c.revenue).toLocaleString('en-US',{style:'currency',currency:'USD'}) : '—'}</td>
                      <td className="p-4">{c.location || '—'}</td>
                      <td className="p-4">{c.contact_count != null ? c.contact_count : '—'}</td>
                      <td className="p-4 text-gray-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                      <td className="p-4"><button title="Delete" onClick={()=>confirmDelete('client', c.id)} className="text-red-500 hover:text-red-600">🗑️</button></td>
                    </tr>
                    {expandedClientId === c.id && (
                      <tr>
                        <td colSpan={8} className="p-5 bg-gray-50">
                          <ClientRowEditor
                            client={c}
                            onSave={async ()=>{ const { data: { session } } = await supabase.auth.getSession(); const token = session?.access_token; const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); const js = resp.ok ? await resp.json() : []; setClients(js||[]); setExpandedClientId(null); }}
                            onCancel={()=> setExpandedClientId(null)}
                          />
                          <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-semibold text-gray-700">Engagement</div>
                              <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm" onClick={(e)=>{ e.stopPropagation(); setLogModal({ type:'client', id: c.id }); }}>Log Activity</button>
                            </div>
                            <ClientActivities clientId={c.id} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}
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
          <button className="ml-4 px-3 py-2 text-sm bg-indigo-600 text-white rounded-md" onClick={()=>{ setAddStage('Pipeline'); setForm({ title:'', client_id:'', value:'', billing_type:'' }); setAddOpen(true); }}>New Opportunity</button>
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
                      <td className="p-4"><div className="flex items-center gap-2">{(() => { const u = o.client && clientsLogoMap.get(String(o.client.id || o.client_id)); return u ? <img src={u} alt="logo" className="w-6 h-6 rounded" /> : <div className="w-6 h-6 rounded bg-gray-200" />; })()} <span className="font-medium">{o.client?.name || o.client?.domain || '—'}</span></div></td>
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
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                          {(() => {
                            const src = o.owner?.avatar_url || (o.owner_id===currentUserId ? currentUserAvatar : '');
                            return src ? <img src={src} alt="owner" className="w-8 h-8 object-cover" /> : null;
                          })()}
                        </div>
                      </td>
                      <td className="p-4 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-right space-x-3">
                        <a className="text-blue-600 font-semibold" href={`/deals/opportunities/${o.id}`}>View</a>
                        <button
                          className="text-red-600"
                          onClick={async ()=>{
                            if (!window.confirm('Delete this opportunity? This will unlink any attached job reqs but will not delete them.')) return;
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              const token = session?.access_token;
                              const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/opportunities/${o.id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
                              if (resp.ok) {
                                // Remove from table immediately
                                setOpps(prev => prev.filter(row => row.id !== o.id));
                                // Also refresh pipeline board in background if currently showing pipeline
                                if (oppView === 'pipeline') { await refetchBoard(); }
                              }
                            } catch {}
                          }}
                        >Delete</button>
                      </td>
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

  const AddModal = () => null;

  const InvoiceModal = () => (
    <CreateInvoiceModal
      open={invoiceOpen}
      opportunities={availableOpps}
      defaultOpportunityId={invoiceOpportunityId}
      defaultBillingType={invoiceBillingType}
      onClose={()=>setInvoiceOpen(false)}
      onCreated={async ()=>{
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const list = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/invoices`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const js = list.ok ? await list.json() : [];
        setInvoices(js || []);
      }}
    />
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
          {activeTab==='opportunities' && (canSee('opportunities') ? <><OpportunitiesSection /><AddOpportunityModal open={addOpen} clients={clients} onClose={()=>setAddOpen(false)} onCreated={async ()=>{ await refetchBoard(); }} /></> : renderAccessDenied())}
          {activeTab==='billing' && (canSee('billing') ? <><BillingSection /><InvoiceModal /></> : renderAccessDenied())}
          {activeTab==='revenue' && (canSee('revenue') ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border">
                  <h2 className="text-sm text-gray-500">Total Revenue</h2>
                  <p className="text-2xl font-semibold mt-1 text-green-600">{(revSummary?.total_paid||0).toLocaleString('en-US', { style:'currency', currency:'USD' })}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border">
                  <h2 className="text-sm text-gray-500">Forecasted Revenue</h2>
                  <p className="text-2xl font-semibold mt-1">{(revSummary?.forecasted||0).toLocaleString('en-US', { style:'currency', currency:'USD' })}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border">
                  <h2 className="text-sm text-gray-500">Open Pipeline (Unpaid)</h2>
                  <p className="text-2xl font-semibold mt-1">{(revSummary?.unpaid||0).toLocaleString('en-US', { style:'currency', currency:'USD' })}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border">
                  <h2 className="text-sm text-gray-500">Overdue Invoices</h2>
                  <p className="text-2xl font-semibold mt-1 text-red-600">{(revSummary?.overdue||0).toLocaleString('en-US', { style:'currency', currency:'USD' })}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-500">Monthly Revenue</h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <button className={`px-2 py-1 rounded ${revMonthlyRange==='90d'?'bg-gray-200':''}`} onClick={()=>setRevMonthlyRange('90d')}>90 Days</button>
                    <button className={`px-2 py-1 rounded ${revMonthlyRange==='6m'?'bg-gray-200':''}`} onClick={()=>setRevMonthlyRange('6m')}>6 Months</button>
                    <button className={`px-2 py-1 rounded ${revMonthlyRange==='1y'?'bg-gray-200':''}`} onClick={()=>setRevMonthlyRange('1y')}>1 Year</button>
                    <button className={`px-2 py-1 rounded ${revMonthlyRange==='ytd'?'bg-gray-200':''}`} onClick={()=>setRevMonthlyRange('ytd')}>YTD</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={`px-2 py-1 rounded ${revMonthlyMode==='actual'?'bg-gray-200':''}`} onClick={()=>setRevMonthlyMode('actual')}>Actual</button>
                    <button className={`px-2 py-1 rounded ${revMonthlyMode==='projected'?'bg-gray-200':''}`} onClick={()=>setRevMonthlyMode('projected')}>Projected</button>
                  </div>
                </div>
              </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(()=>{
                    const src = revMonthlyMode==='actual' ? revMonthly : revMonthlyProjected;
                    const now = new Date();
                    let start: Date;
                    if (revMonthlyRange==='ytd') {
                      start = new Date(now.getFullYear(), 0, 1);
                    } else {
                      const monthsBack = revMonthlyRange==='90d' ? 3 : revMonthlyRange==='6m' ? 6 : 12;
                      start = new Date(now.getFullYear(), now.getMonth()-monthsBack+1, 1);
                    }
                    const parseMonth = (s: string) => {
                      const [y,m] = String(s).split('-');
                      const yy = Number(y); const mm = Number(m)-1; if (!isFinite(yy) || !isFinite(mm)) return new Date(0);
                      return new Date(yy, mm, 1);
                    };
                    return (src||[]).filter(r => parseMonth(r.month) >= start);
                  })()}>
                        <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                        <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v)=>`$${Math.round(v/1000)}k`} />
                        <Tooltip formatter={(v)=>[(Number(v).toLocaleString('en-US',{style:'currency',currency:'USD'})),'']} />
                        <Legend />
                        <Bar dataKey="paid" stackId="a" fill="#10b981" name="Paid" />
                        <Bar dataKey="forecasted" stackId="a" fill="#3b82f6" name="Forecasted" />
                        <Bar dataKey="outstanding" stackId="a" fill="#f59e0b" name="Outstanding" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Top Clients</h3>
                  <div className="space-y-2">
                    {(() => {
                      const topMax = Math.max(1, ...revByClient.map(r => Number(r.total) || 0));
                      return revByClient.map(row => (
                        <div key={row.client_id} className="flex items-center gap-3">
                          <div className="w-40 text-sm text-gray-700 truncate">{row.client_name}</div>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${Math.max(4, Math.round(((Number(row.total)||0) / topMax) * 100))}%` }} />
                          </div>
                          <div className="w-28 text-right text-sm">{Number(row.total||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Engagement Types</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={revByType} dataKey="total" nameKey="type" innerRadius={50} outerRadius={80} label>
                        {revByType.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={["#8b5cf6","#3b82f6","#10b981","#f59e0b"][idx % 4]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v)=>[(Number(v).toLocaleString('en-US',{style:'currency',currency:'USD'})),'']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : renderAccessDenied())}
        </>
      )}
      {logModal && (
        <DealLogActivityModal entityType={logModal.type} entityId={logModal.id} onClose={()=>setLogModal(null)} onSaved={()=>{
          // force-refresh client activities when modal saves
          setClients(prev=>[...prev]);
          setExpandedClientId(prev=>prev); // keep open
        }} />
      )}
    </div>
  );
}


