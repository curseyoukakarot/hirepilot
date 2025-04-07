// src/screens/MessageGenerator.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FaPaperPlane, FaSave } from 'react-icons/fa';

export default function MessageGenerator() {
  const [role, setRole] = useState('');
  const [tone, setTone] = useState('Professional');
  const [persona, setPersona] = useState('');
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

 const generateMessage = async () => {
  setOutput('Generating...');
  setError(null);

  try {
    const res = await fetch('/api/generate-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role,
        tone,
        persona,
        prompt
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    setOutput(data.message);
  } catch (err) {
    console.error('Generate message error:', err);
    setError(err.message);
    setOutput('');
  }
};

  const saveMessage = async () => {
    const user = await supabase.auth.getUser();
    const { data, error } = await supabase.from('campaign_messages').insert({
      campaign_id: null, // Replace with selected campaign ID if applicable
      lead_name: 'N/A',
      lead_email: 'N/A',
      message_content: message,
      status: 'draft',
    });
    if (error) console.error('Error saving message:', error);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Message Generator</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block mb-2 font-medium">Role</label>
            <input className="w-full border p-2 rounded" placeholder="e.g. Software Engineer" value={role} onChange={e => setRole(e.target.value)} />

            <label className="block mt-4 mb-2 font-medium">Tone</label>
            <select className="w-full border p-2 rounded" value={tone} onChange={e => setTone(e.target.value)}>
              <option>Professional</option>
              <option>Casual</option>
              <option>Friendly</option>
              <option>Formal</option>
            </select>

            <label className="block mt-4 mb-2 font-medium">Persona</label>
            <input className="w-full border p-2 rounded" placeholder="e.g. Tech Recruiter" value={persona} onChange={e => setPersona(e.target.value)} />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <label className="block mb-2 font-medium">Prompt</label>
            <textarea className="w-full border rounded p-2 h-32" value={prompt} onChange={e => setPrompt(e.target.value)} />
            <button disabled={loading} onClick={generateMessage} className="mt-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
              {loading ? 'Generating...' : 'Generate Message'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Generated Message</h3>
            <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded p-2 h-64" placeholder="Generated message will appear here..." />
          </div>

          <div className="flex space-x-4">
            <button onClick={saveMessage} className="bg-blue-600 text-white py-2 px-4 rounded flex items-center justify-center">
              <FaPaperPlane className="mr-2" /> Use Message
            </button>
            <button onClick={saveMessage} className="border border-gray-300 text-gray-700 py-2 px-4 rounded flex items-center justify-center">
              <FaSave className="mr-2" /> Save as Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
