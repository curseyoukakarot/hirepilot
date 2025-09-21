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
      <div className="md:col-span-2 flex items-end justify-end gap-2">
        <button className="px-3 py-1.5 text-sm" onClick={onCancel}>Cancel</button>
        <button className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

export default React.memo(ClientRowEditor);


