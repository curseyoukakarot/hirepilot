import React from 'react';

export default function AddGuestModal({ open, onClose, onSubmit, initialEmail = '', initialRole = 'View Only', loading = false }) {
  const [email, setEmail] = React.useState(initialEmail);
  const [role, setRole] = React.useState(initialRole);

  React.useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  React.useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Invite Guest</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" className="w-full border rounded-lg px-3 py-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="w-full border rounded-lg px-3 py-2" value={role} onChange={(e)=>setRole(e.target.value)}>
              <option>View Only</option>
              <option>View + Comment</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 border rounded-lg" onClick={onClose} disabled={loading}>Cancel</button>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50" disabled={!email || loading} onClick={() => onSubmit({ email, role })}>
              {loading ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
