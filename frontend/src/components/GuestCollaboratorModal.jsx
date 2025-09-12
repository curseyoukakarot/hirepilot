import React, { useEffect, useState } from 'react';

export default function GuestCollaboratorModal({
  open,
  onClose,
  mode = 'add', // 'add' | 'edit'
  defaultValues = {},
  jobOptions = [],
  onSubmit,
  loading = false,
}) {
  const [email, setEmail] = useState(defaultValues.email || '');
  const [role, setRole] = useState(defaultValues.role || 'View Only');
  const [jobs, setJobs] = useState(defaultValues.jobs || []);

  useEffect(() => {
    setEmail(defaultValues.email || '');
    setRole(defaultValues.role || 'View Only');
    setJobs(defaultValues.jobs || []);
  }, [defaultValues, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{mode === 'add' ? 'Add Collaborator' : 'Edit Collaborator'}</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="guest@example.com"
              readOnly={mode === 'edit'}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Role</label>
            <select value={role} onChange={(e)=>setRole(e.target.value)} className="w-full border rounded px-3 py-2">
              <option>View Only</option>
              <option>Commenter</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Job Requisitions</label>
            <div className="border rounded p-2 max-h-48 overflow-y-auto">
              {jobOptions.length === 0 && <div className="text-sm text-gray-500">No jobs found</div>}
              {jobOptions.map(j => (
                <label key={j.id} className="flex items-center gap-2 text-sm py-1">
                  <input type="checkbox" checked={jobs.includes(j.id)} onChange={(e)=>{
                    if (e.target.checked) setJobs(prev => [...new Set([...prev, j.id])]);
                    else setJobs(prev => prev.filter(id => id !== j.id));
                  }} />
                  <span>{j.title}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Select one or more. If none selected, invite will not be linked to a specific job.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="px-4 py-2 border rounded" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
            disabled={loading || !email}
            onClick={()=>onSubmit({ email, role, jobs })}
          >
            {loading ? 'Saving…' : (mode === 'add' ? 'Add Collaborator' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}
