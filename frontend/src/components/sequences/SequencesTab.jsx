import React, { useEffect, useState } from 'react';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function SequencesTab({ onEditSequence }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const token = (await window?.supabase?.auth?.getSession?.())?.data?.session?.access_token;
      const res = await fetch(`${API_BASE_URL}/sequences?include_steps=1`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to load sequences');
      const data = await res.json();
      setRows(data || []);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e.message || 'Failed to load sequences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleArchive = async (seq) => {
    try {
      const token = (await window?.supabase?.auth?.getSession?.())?.data?.session?.access_token;
      const res = await fetch(`${API_BASE_URL}/sequences/${seq.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ archive: !seq.is_archived }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to update');
      await load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e.message || 'Failed');
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Sequences</h3>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Steps</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-6 text-center text-gray-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-6 text-center text-gray-500">No sequences yet</td></tr>
            ) : rows.map((seq) => (
              <tr key={seq.id}>
                <td className="px-6 py-3">
                  <div className="font-medium text-gray-900">{seq.name}</div>
                  <div className="text-xs text-gray-500">{seq.description}</div>
                </td>
                <td className="px-6 py-3 text-sm text-gray-700">{(seq.steps || []).length}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${seq.is_archived ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'}`}>{seq.is_archived ? 'Archived' : 'Active'}</span>
                </td>
                <td className="px-6 py-3 text-right space-x-2">
                  <button className="px-3 py-1 border rounded-lg hover:bg-gray-50" onClick={() => onEditSequence?.(seq)}>Edit</button>
                  <button className="px-3 py-1 border rounded-lg hover:bg-gray-50" onClick={() => toggleArchive(seq)}>{seq.is_archived ? 'Unarchive' : 'Archive'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


