import React, { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface ClientRowEditorProps {
  client: any;
  onSave: () => void;
  onCancel: () => void;
}

function ClientRowEditor({ client, onSave, onCancel }: ClientRowEditorProps) {
  const manual = client?.org_meta?.manual || {};
  const [name, setName] = useState<string>(client.name || '');
  const [website, setWebsite] = useState<string>(client.domain || '');
  const [industry, setIndustry] = useState<string>(client.industry || '');
  const [location, setLocation] = useState<string>(client.location || '');
  const [saving, setSaving] = useState<boolean>(false);
  const org = (client?.org_meta?.apollo?.organization) || {};
  const manualRevenuePrinted = manual?.revenue_printed || manual?.revenue || null;
  const manualFundingPrinted = manual?.total_funding_printed || null;
  const manualFoundedYear = manual?.founded_year || null;
  const totalFundingPrinted = manualFundingPrinted || client?.org_meta?.apollo?.total_funding_printed || org?.total_funding_printed || null;
  const revenuePrinted = manualRevenuePrinted || org?.organization_revenue_printed || org?.annual_revenue_printed || org?.estimated_annual_revenue || null;
  const foundedYear = manualFoundedYear || org?.founded_year || null;
  const manualTech = Array.isArray(manual?.technology_names) ? manual.technology_names : [];
  const manualKeywords = Array.isArray(manual?.keywords) ? manual.keywords : [];
  const techNames: string[] = Array.from(new Set([
    ...manualTech,
    ...((org?.technology_names || []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean)),
    ...((org?.current_technologies || []).map((t: any) => typeof t === 'string' ? t : t?.name).filter(Boolean))
  ]));
  const keywords: string[] = manualKeywords.length ? manualKeywords : (Array.isArray(org?.keywords) ? org.keywords.slice(0, 12) : []);
  const [revenueInput, setRevenueInput] = useState<string>(revenuePrinted ? String(revenuePrinted) : (client?.revenue != null ? String(client.revenue) : ''));
  const [fundingInput, setFundingInput] = useState<string>(totalFundingPrinted ? String(totalFundingPrinted) : '');
  const [foundedInput, setFoundedInput] = useState<string>(foundedYear ? String(foundedYear) : '');
  const [techStackInput, setTechStackInput] = useState<string>(techNames.join(', '));
  const [keywordsInput, setKeywordsInput] = useState<string>(keywords.join(', '));

  const parseRevenueInput = (value: string): number | null => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const upper = raw.toUpperCase();
    const multiplier = upper.endsWith('B') ? 1_000_000_000 : upper.endsWith('M') ? 1_000_000 : upper.endsWith('K') ? 1_000 : 1;
    const cleaned = upper.replace(/[^0-9.]/g, '');
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return null;
    return Math.round(num * multiplier);
  };

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const techStackList = techStackInput.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean);
      const keywordsList = keywordsInput.split(/[,;\n]/).map((k) => k.trim()).filter(Boolean);
      const revenueNumber = parseRevenueInput(revenueInput);
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          name: name || null,
          domain: website || null,
          industry: industry || null,
          location: location || null,
          revenue: revenueNumber,
          org_meta: {
            manual: {
              revenue_printed: revenueInput.trim() || null,
              total_funding_printed: fundingInput.trim() || null,
              founded_year: foundedInput.trim() || null,
              technology_names: techStackList,
              keywords: keywordsList
            }
          }
        })
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }, [client.id, name, website, industry, location, revenueInput, fundingInput, foundedInput, techStackInput, keywordsInput, onSave]);

  const syncFromEnrichment = useCallback(async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/clients/${client.id}/sync-enrichment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ override: false, name: client?.name || null, domain: client?.domain || null })
      });
      if (!resp.ok) {
        try { console.warn('sync enrichment failed', await resp.json()); } catch {}
      }
      onSave();
    } finally { setSaving(false); }
  }, [client?.name, client?.domain, client.id, onSave]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Company Insights</h4>
        <div className="text-sm text-gray-600 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 w-20">Name</span>
            <input className="border rounded px-2 py-1 w-full" value={name} onChange={(e)=>setName(e.target.value)} />
          </div>
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
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={revenueInput}
              onChange={(e)=>setRevenueInput(e.target.value)}
              placeholder="e.g., 300K"
            />
          </div>
          <div className="p-3 bg-white border rounded">
            <div className="text-xs text-gray-500 mb-1">Funding</div>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={fundingInput}
              onChange={(e)=>setFundingInput(e.target.value)}
              placeholder="e.g., 22.7M"
            />
          </div>
          <div className="p-3 bg-white border rounded">
            <div className="text-xs text-gray-500 mb-1">Founded</div>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={foundedInput}
              onChange={(e)=>setFoundedInput(e.target.value)}
              placeholder="e.g., 2021"
            />
          </div>
          <div className="p-3 bg-white border rounded">
            <div className="text-xs text-gray-500 mb-1">Tech Stack</div>
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={techStackInput}
              onChange={(e)=>setTechStackInput(e.target.value)}
              placeholder="Comma-separated technologies"
            />
          </div>
        </div>
        <div className="mt-4 p-3 bg-white border rounded">
          <div className="text-xs text-gray-500 mb-2">Keywords</div>
          <input
            className="border rounded px-2 py-1 w-full text-sm"
            value={keywordsInput}
            onChange={(e)=>setKeywordsInput(e.target.value)}
            placeholder="Comma-separated keywords"
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded" disabled={saving} onClick={syncFromEnrichment}>Sync from Enrichment</button>
          <button className="px-3 py-1.5 text-sm" onClick={onCancel}>Cancel</button>
          <button className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ClientRowEditor);


