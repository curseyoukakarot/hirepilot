import React from 'react';
import { FaSlack, FaCircleInfo } from 'react-icons/fa6';

export default function SettingsNotifications() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <div className="flex items-center space-x-4">
            <button className="text-gray-600 hover:text-gray-900">
              <i className="fa-regular fa-bell text-xl"></i>
            </button>
            <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg" alt="Profile" className="w-10 h-10 rounded-full" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex space-x-1 bg-white rounded-lg p-1 mb-8 border">
          <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-900">Profile Info</button>
          <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-900">Integrations</button>
          <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-900">Team Settings</button>
          <button className="flex-1 py-3 px-4 text-sm font-medium rounded-md bg-blue-50 text-blue-600">Notifications</button>
          <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-900">API Keys</button>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold">Notification Settings</h2>
              <p className="text-sm text-gray-500 mt-1">Manage how you receive notifications</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Email Notifications */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Email Notifications</h3>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Connected</span>
              </div>

              <div className="space-y-4">
                {[
                  {
                    label: 'Campaign Updates',
                    description: 'Get notified about campaign status changes',
                    checked: true,
                  },
                  {
                    label: 'Team Activity',
                    description: 'Notifications about team member actions',
                    checked: true,
                  },
                  {
                    label: 'Weekly Reports',
                    description: 'Receive weekly performance reports',
                    checked: false,
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between py-3 ${index > 0 ? 'border-t' : ''}`}
                  >
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked={item.checked} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Slack Integration */}
            <div className="pt-6 border-t">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium">Slack Integration</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Get notifications directly in your Slack workspace
                  </p>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                  <FaSlack className="mr-2" /> Connect Slack
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  <FaCircleInfo className="text-blue-500" />
                  <p>
                    Connect your Slack workspace to receive real-time notifications about important updates and
                    activities.
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Notifications */}
            <div className="pt-6 border-t">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Mobile Push Notifications</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-500">Receive notifications on your mobile device</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
