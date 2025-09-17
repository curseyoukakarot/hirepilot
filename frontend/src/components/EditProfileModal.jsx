import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function EditProfileModal({
  isOpen,
  onClose,
  entityType = 'lead',
  entity = {},
  onSaved
}) {
  const [firstName, setFirstName] = useState(entity.first_name || '');
  const [lastName, setLastName] = useState(entity.last_name || '');
  const [email, setEmail] = useState(entity.email || '');
  const [phone, setPhone] = useState(entity.phone || '');
  const [linkedinUrl, setLinkedinUrl] = useState(entity.linkedin_url || '');
  const [tags, setTags] = useState(
    Array.isArray(entity.tags) ? entity.tags.join(', ') : (entity.tags || '')
  );
  const [saving, setSaving] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    setFirstName(entity.first_name || '');
    setLastName(entity.last_name || '');
    setEmail(entity.email || '');
    setPhone(entity.phone || '');
    setLinkedinUrl(entity.linkedin_url || '');
    setTags(Array.isArray(entity.tags) ? entity.tags.join(', ') : (entity.tags || ''));
  }, [entity]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const common = { email: email || null, phone: phone || null };

      if (entityType === 'candidate') {
        // Update main fields via backend (ensures RLS/ownership checks)
        await fetch(`${BACKEND_URL}/api/leads/candidates/${entity.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...common,
            first_name: firstName,
            last_name: lastName,
          })
        }).then(async (r) => {
          if (!r.ok) {
            const js = await r.json().catch(() => ({}));
            throw new Error(js?.error || `HTTP ${r.status}`);
          }
        });

        // linkedin_url is not supported by that endpoint → direct update guarded by RLS
        await supabase
          .from('candidates')
          .update({ linkedin_url: linkedinUrl || null })
          .eq('id', entity.id);

        const updated = {
          ...entity,
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          linkedin_url: linkedinUrl || null,
        };
        onSaved && onSaved(updated);
      } else {
        // Lead update via backend
        const name = `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim() || entity.name || null;
        const parsedTags = (tags || '').split(',').map(t => t.trim()).filter(Boolean);

        await fetch(`${BACKEND_URL}/api/leads/${entity.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...common,
            name,
            linkedin_url: linkedinUrl || null,
            tags: parsedTags,
          })
        }).then(async (r) => {
          if (!r.ok) {
            const js = await r.json().catch(() => ({}));
            throw new Error(js?.error || `HTTP ${r.status}`);
          }
        });

        const updated = {
          ...entity,
          name,
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          linkedin_url: linkedinUrl || null,
          tags: parsedTags,
        };
        onSaved && onSaved(updated);
      }

      onClose();
    } catch (e) {
      alert(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Profile</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">First name</label>
              <input value={firstName} onChange={(e)=>setFirstName(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Last name</label>
              <input value={lastName} onChange={(e)=>setLastName(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Phone</label>
            <input value={phone} onChange={(e)=>setPhone(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">LinkedIn URL</label>
            <input value={linkedinUrl} onChange={(e)=>setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/..." className="w-full border rounded px-3 py-2" />
          </div>
          {entityType === 'lead' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tags (comma separated)</label>
              <input value={tags} onChange={(e)=>setTags(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}


