import React, { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface ClientRowEditorProps {
  client: any;
  onSave: () => void;
  onCancel: () => void;
}

function ClientRowEditor({ client, onSave, onCancel }: ClientRowEditorProps) {
  const [website, setWebsite] = useState<string>(client.domain || '');
  const [industry, setIndustry] = useState<string>(client.industry || '');
  const [location, setLocation] = useState<string>(client.location || '');
  const [saving, setSaving] = useState<boolean>(false);
  const org = (client?.org_meta?.apollo?.organization) || {};
  const totalFundingPrinted = client?.org_meta?.apollo?.total_funding_printed || org?.total_funding_printed || null;
  const revenuePrinted = org?.organization_revenue_printed || org?.annual_revenue_printed || org?.estimated_annual_revenue || null;
  const foundedYear = org?.founded_year || null;
  const techNames: string[] = Array.from(new Set([
    ...((org?.technology_names || []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean)),
    ...((org?.current_technologies || []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean))
  ]));
  const keywords: string[] = Array.isArray(org?.keywords) ? org.keywords.slice(0, 12) : [];

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ domain: website, industry, location })
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }, [client.id, website, industry, location, onSave]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Company Insights</h4>
        <div className="text-sm text-gray-600 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-20">Website</span>
            <input className="border rounded px-2 py-1 w-full" value={website} onChange={(e)=>setWebsite(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-20">Industry</span>
            <input className="border rounded px-2 py-1 w-full" value={industry} onChange={(e)=>setIndustry(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-20">Location</span>
            <input className="border rounded px-2 py-1 w-full" value={location} onChange={(e)=>setLocation(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="md:col-span-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-white border rounded">
            <div className="text-xs text-gray-500 mb-1">Revenue</div>
            <div className="text-sm text-gray-900">{revenuePrinted || '—'}</div>
          </div>
          <div className="p-3 bg-white border rounded">
            <div className="text-xs text-gray-500 mb-1">Funding</div>
            <div className="text-sm text-gray-900">{totalFundingPrinted || '—'}</div>
          </div>
          <div className="p-3 bg-white border rounded">
            <div className="text-xs text-gray-500 mb-1">Founded</div>
            <div className="text-sm text-gray-900">{foundedYear || '—'}</div>
          </div>
          <div className="p-3 bg-white border rounded">
            <div className="text-xs text-gray-500 mb-1">Tech Stack</div>
            <div className="flex flex-wrap gap-1">
              {techNames.length ? techNames.slice(0, 8).map((t: string, i: number) => (
                <span key={`${t}-${i}`} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">{t}</span>
              )) : <span className="text-sm text-gray-500">—</span>}
            </div>
          </div>
        </div>
        {keywords.length > 0 && (
          <div className="mt-4 p-3 bg-white border rounded">
            <div className="text-xs text-gray-500 mb-2">Keywords</div>
            <div className="flex flex-wrap gap-1">
              {keywords.map((k, idx) => (
                <span key={`${k}-${idx}`} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">{k}</span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 text-sm" onClick={onCancel}>Cancel</button>
          <button className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ClientRowEditor);


