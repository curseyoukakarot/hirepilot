import React, { useState } from 'react';
import {
  FaSearchPlus,
  FaPaperPlane,
  FaPen,
  FaUser,
  FaRotateRight,
  FaSave,
} from 'react-icons/fa6';

export default function MessageGenerator() {
  const [selectedMode, setSelectedMode] = useState('boolean');
  const [role, setRole] = useState('');
  const [tone, setTone] = useState('Professional');
  const [persona, setPersona] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generated, setGenerated] = useState('');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="text-xl font-bold text-blue-600">HirePilot</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Message Generator</h1>
          <p className="mt-2 text-gray-600">Generate personalized outreach messages using AI</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Mode Selector */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Mode</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  className={`flex items-center justify-center px-4 py-2 border rounded-md ${selectedMode === 'boolean' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setSelectedMode('boolean')}
                >
                  <FaSearchPlus className="mr-2" /> Boolean Builder
                </button>
                <button
                  className={`flex items-center justify-center px-4 py-2 border rounded-md ${selectedMode === 'outreach' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setSelectedMode('outreach')}
                >
                  <FaPaperPlane className="mr-2" /> Outreach Message
                </button>
                <button
                  className={`flex items-center justify-center px-4 py-2 border rounded-md ${selectedMode === 'rewrite' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setSelectedMode('rewrite')}
                >
                  <FaPen className="mr-2" /> Rewrite Copy
                </button>
                <button
                  className={`flex items-center justify-center px-4 py-2 border rounded-md ${selectedMode === 'personalize' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setSelectedMode('personalize')}
                >
                  <FaUser className="mr-2" /> Personalize
                </button>
              </div>
            </div>

            {/* Parameters */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Parameters</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g. Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option>Professional</option>
                    <option>Casual</option>
                    <option>Friendly</option>
                    <option>Formal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Persona</label>
                  <input
                    type="text"
                    value={persona}
                    onChange={(e) => setPersona(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g. Tech Recruiter"
                  />
                </div>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter your prompt here..."
              ></textarea>
            </div>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Generated Message</h3>
                <button className="text-blue-600 hover:text-blue-700">
                  <FaRotateRight className="mr-1" /> Regenerate
                </button>
              </div>
              <textarea
                value={generated}
                onChange={(e) => setGenerated(e.target.value)}
                className="w-full h-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Generated message will appear here..."
              ></textarea>
            </div>

            <div className="flex space-x-4">
              <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center">
                <FaPaperPlane className="mr-2" /> Use Message
              </button>
              <button className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 flex items-center justify-center">
                <FaSave className="mr-2" /> Save as Draft
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
