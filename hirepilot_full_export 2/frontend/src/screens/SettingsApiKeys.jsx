import React, { useEffect, useState } from 'react';
import { FaRocket, FaVial, FaCode, FaCopy, FaWebhook, FaPlus } from 'react-icons/fa6';

export default function SettingsApiKeys() {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchKeys = async () => {
    const res = await fetch('/api/getApiKeys');
    const data = await res.json();
    if (res.ok) {
      setApiKeys(data.apiKeys);
    } else {
      console.error('Error fetching API keys:', data.error);
    }
  };

  const generateKey = async () => {
    setLoading(true);
    const res = await fetch('/api/createApiKey', { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setApiKeys((prev) => [...prev, data.apiKey]);
    } else {
      console.error('Error creating API key:', data.error);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h2 className="text-xl font-semibold mb-1">API Keys</h2>
          <p className="text-sm text-gray-500">Manage your API keys for different environments</p>
        </div>

        <div className="mb-10 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Available Environments</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded border">
              <div className="flex items-center space-x-2 mb-2">
                <FaRocket className="text-green-500" />
                <span className="font-medium">Production</span>
              </div>
              <p className="text-sm text-gray-500">Live environment for your application</p>
            </div>
            <div className="p-4 bg-white rounded border">
              <div className="flex items-center space-x-2 mb-2">
                <FaVial className="text-yellow-500" />
                <span className="font-medium">Staging</span>
              </div>
              <p className="text-sm text-gray-500">Testing environment for development</p>
            </div>
            <div className="p-4 bg-white rounded border">
              <div className="flex items-center space-x-2 mb-2">
                <FaCode className="text-purple-500" />
                <span className="font-medium">Development</span>
              </div>
              <p className="text-sm text-gray-500">Local development environment</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <button
            onClick={generateKey}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            {loading ? 'Generating...' : (
              <>
                <FaPlus className="mr-2" /> Generate New Key
              </>
            )}
          </button>
        </div>

        <div className="space-y-4">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-gray-500">No API keys found.</p>
          ) : (
            apiKeys.map((keyObj) => (
              <div key={keyObj.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium capitalize">{keyObj.environment} API Key</h3>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={keyObj.key}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-50 border rounded-md font-mono text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(keyObj.key)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title="Copy API Key"
                  >
                    <FaCopy />
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  Created on {new Date(keyObj.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
