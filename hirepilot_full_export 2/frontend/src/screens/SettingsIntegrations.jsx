// SettingsIntegrations.jsx
import React from 'react';
import { FaBell, FaCircle, FaPuzzlePiece, FaRocket, FaGhost, FaEnvelope, FaCalendarDays, FaGear, FaPlus } from 'react-icons/fa6';

export default function SettingsIntegrations() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-gray-900">
                <FaBell className="text-xl" />
              </button>
              <img
                src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
                alt="Profile"
                className="w-10 h-10 rounded-full"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="container mx-auto px-6 py-8">
        <div className="flex space-x-1 bg-white rounded-lg p-1 mb-8 border">
          <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-900">Profile Info</button>
          <button className="flex-1 py-3 px-4 text-sm font-medium rounded-md bg-blue-50 text-blue-600">Integrations</button>
          <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-900">Team Settings</button>
          <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-900">Notifications</button>
          <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-900">API Keys</button>
        </div>

        {/* Integrations Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Connected Applications</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <FaCircle className="text-green-500" />
              <span>3 Active Connections</span>
            </div>
          </div>

          <div className="space-y-6">
            {[
              { id: 'clay', icon: <FaPuzzlePiece className="text-blue-600" />, name: 'Clay', status: 'Active', date: 'Jan 15, 2025', bg: 'bg-blue-100' },
              { id: 'apollo', icon: <FaRocket className="text-purple-600" />, name: 'Apollo', status: 'Not Connected', date: '—', bg: 'bg-purple-100' },
              { id: 'phantom', icon: <FaGhost className="text-indigo-600" />, name: 'PhantomBuster', status: 'Active', date: 'Feb 1, 2025', bg: 'bg-indigo-100' },
              { id: 'sendgrid', icon: <FaEnvelope className="text-green-600" />, name: 'SendGrid', status: 'Active', date: 'Mar 1, 2025', bg: 'bg-green-100' },
              { id: 'monday', icon: <FaCalendarDays className="text-yellow-600" />, name: 'Monday.com', status: 'Not Connected', date: '—', bg: 'bg-yellow-100' }
            ].map(({ id, icon, name, status, date, bg }) => (
              <div
                key={id}
                className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-all"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium">{name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {status === 'Active' ? `Connected on ${date}` : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="text-gray-400 hover:text-gray-600">
                    <FaGear className="text-xl" />
                  </button>
                  {status === 'Active' ? (
                    <button className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm font-medium hover:bg-red-50">
                      Disconnect
                    </button>
                  ) : (
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
