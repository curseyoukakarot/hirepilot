import React, { useState } from 'react';
import InviteCollaboratorsModal from '../InviteCollaboratorsModal';

interface Collab {
  id: string;
  name: string;
  role: 'viewer' | 'commenter' | 'editor';
}

export default function TeamTab() {
  const [collabs, setCollabs] = useState<Collab[]>([
    { id: '1', name: 'Alice', role: 'editor' },
    { id: '2', name: 'Bob', role: 'commenter' },
  ]);
  const [showModal, setShowModal] = useState(false);

  const updateRole = (id: string, role: Collab['role']) => {
    setCollabs(collabs.map((c) => (c.id === id ? { ...c, role } : c)));
  };

  const remove = (id: string) => {
    setCollabs(collabs.filter((c) => c.id !== id));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Assigned Team</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 text-sm"
        >
          Add Teammate
        </button>
      </div>
      <div className="space-y-4">
        {collabs.map((c) => (
          <div key={c.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={`https://ui-avatars.com/api/?name=${c.name}`}
                className="w-10 h-10 rounded-full"
                alt={c.name}
              />
              <span className="text-sm font-medium text-gray-900">{c.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={c.role}
                onChange={(e) => updateRole(c.id, e.target.value as Collab['role'])}
                className="border rounded p-1 text-sm"
              >
                <option value="viewer">Viewer</option>
                <option value="commenter">Commenter</option>
                <option value="editor">Editor</option>
              </select>
              <button
                onClick={() => remove(c.id)}
                className="text-gray-500 hover:text-red-600"
                aria-label="Remove"
              >
                <span className="sr-only">Remove</span>🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
      {showModal && <InviteCollaboratorsModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
