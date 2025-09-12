import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function UpgradeModal({ feature = 'This feature', onClose }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-2">Premium access required</h3>
        <p className="text-sm text-gray-600 mb-4">{feature} is available on paid plans or for invited collaborators.</p>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 border rounded" onClick={onClose}>Close</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => navigate('/billing')}>Go to Billing</button>
        </div>
      </div>
    </div>
  );
}
