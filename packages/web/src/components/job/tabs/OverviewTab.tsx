import React, { useState } from 'react';
import MentionInput from '../MentionInput';

export default function OverviewTab() {
  const [description, setDescription] = useState('Describe the role...');
  const [notes, setNotes] = useState<string[]>([
    'Initial note from Alice',
  ]);
  const [input, setInput] = useState('');

  const addNote = () => {
    if (!input.trim()) return;
    setNotes([...notes, input.trim()]);
    setInput('');
    console.log('activity', {
      type: 'comment_added',
      metadata: { text: input.trim() },
    });
  };

  const saveDescription = () => {
    console.log('activity', {
      type: 'updated_description',
      metadata: { fields: ['description'] },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Role Description</h2>
            <button
              onClick={saveDescription}
              className="text-sm text-blue-600 hover:underline"
            >
              Save
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded p-2 focus:outline-none"
            rows={4}
          />
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Success Profile</h2>
          <div className="flex flex-wrap gap-2">
            {['Collaboration', 'Initiative', 'Growth mindset'].map((trait) => (
              <span
                key={trait}
                className="px-3 py-1 bg-gray-50 rounded text-sm text-gray-700"
              >
                {trait}
              </span>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Internal Notes</h2>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {notes.map((n, i) => (
              <div key={i} className="flex items-start gap-3">
                <img
                  src={`https://ui-avatars.com/api/?name=User${i}`}
                  className="w-8 h-8 rounded-full"
                  alt="avatar"
                />
                <div className="bg-gray-50 rounded-lg p-3 w-full">
                  <p className="text-sm text-gray-700">{n}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <MentionInput value={input} onChange={setInput} onSubmit={addNote} />
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
          <dl className="grid grid-cols-1 gap-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="font-medium text-gray-500">Department</dt>
              <dd className="text-gray-900">Engineering</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium text-gray-500">Location</dt>
              <dd className="text-gray-900">Remote</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium text-gray-500">Level</dt>
              <dd className="text-gray-900">Senior</dd>
            </div>
          </dl>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Team</h3>
          <div className="space-y-3">
            {[
              { id: '1', name: 'Alice', role: 'editor' },
              { id: '2', name: 'Bob', role: 'commenter' },
            ].map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <img
                  src={`https://ui-avatars.com/api/?name=${m.name}`}
                  className="w-10 h-10 rounded-full"
                  alt={m.name}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  <p className="text-sm text-gray-500 capitalize">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
