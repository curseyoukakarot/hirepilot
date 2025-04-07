import React from 'react';
import { FaRocket, FaVial, FaCode, FaCopy, FaWebhook } from 'react-icons/fa6';

export default function SettingsApiKeys() {
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

        <div className="space-y-8">
          <div className="border rounded-lg">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <FaRocket className="text-green-500" />
                <h3 className="font-medium">Production API Key</h3>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
              </div>
              <button className="text-red-600 hover:text-red-700 text-sm font-medium">Revoke</button>
            </div>
            <div className="p-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="text"
                  value="hp_live_2x94K8nXp6v3mQ9RjLwTkY5H"
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border rounded-md font-mono text-sm"
                />
                <button className="p-2 text-gray-500 hover:text-gray-700" title="Copy API Key">
                  <FaCopy />
                </button>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Created on Mar 15, 2025</span>
                <span>Last used: 2 hours ago</span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <FaWebhook className="text-blue-500" />
                <h3 className="font-medium">Webhook Secret</h3>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Webhook</span>
              </div>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Rotate Secret</button>
            </div>
            <div className="p-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="text"
                  value="whsec_1234567890abcdefghijklmnopqrstuvwxyz"
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border rounded-md font-mono text-sm"
                />
                <button className="p-2 text-gray-500 hover:text-gray-700" title="Copy Webhook Secret">
                  <FaCopy />
                </button>
              </div>
              <span className="text-sm text-gray-500">Created on Mar 10, 2025</span>
            </div>
          </div>

          <div className="border rounded-lg">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <FaVial className="text-yellow-500" />
                <h3 className="font-medium">Test API Key</h3>
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">Test</span>
              </div>
              <button className="text-red-600 hover:text-red-700 text-sm font-medium">Revoke</button>
            </div>
            <div className="p-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="text"
                  value="hp_test_7yJ2mK9nXp4v8qW3rLzTkY5H"
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border rounded-md font-mono text-sm"
                />
                <button className="p-2 text-gray-500 hover:text-gray-700" title="Copy API Key">
                  <FaCopy />
                </button>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Created on Mar 1, 2025</span>
                <span>Last used: 5 days ago</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
