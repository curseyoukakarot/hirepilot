import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [latestUser, setLatestUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestUser = async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        const users = await res.json();
        // Get the most recent user
        const sortedUsers = users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setLatestUser(sortedUsers[0]);
      } catch (err) {
        console.error('Failed to fetch latest user:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestUser();
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-gray-800 to-black min-h-screen">
      {/* Main Content (dashboard widgets, tables, etc.) goes here */}
      <div id="dashboard-content" className="flex-1 overflow-y-auto p-6 bg-gray-900">
        {/* Quick Stats, App Health, Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Quick Stats */}
          <div id="quick-stats" className="bg-gray-800 p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-100">System Overview</h2>
              <span className="text-xs text-gray-400">Last updated: 2 mins ago</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-200">Active Users</span>
                  <span className="text-blue-600">
                    <i className="fa-solid fa-user"></i>
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-gray-100">247</span>
                  <span className="text-green-600 text-xs ml-2">+5%</span>
                </div>
              </div>
              <div className="bg-gray-700 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-200">Phantom Tasks</span>
                  <span className="text-blue-600">
                    <i className="fa-solid fa-robot"></i>
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-gray-100">32</span>
                  <span className="text-xs text-gray-400 ml-2">Running</span>
                </div>
              </div>
              <div className="bg-gray-700 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-200">Failed Tasks</span>
                  <span className="text-red-500">
                    <i className="fa-solid fa-exclamation-circle"></i>
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-gray-100">3</span>
                  <span className="text-red-500 text-xs ml-2">Action needed</span>
                </div>
              </div>
              <div className="bg-gray-700 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-200">API Calls</span>
                  <span className="text-blue-600">
                    <i className="fa-solid fa-code"></i>
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-gray-100">5.2k</span>
                  <span className="text-gray-400 text-xs ml-2">Today</span>
                </div>
              </div>
            </div>
          </div>
          {/* App Health Monitor */}
          <div id="app-health-monitor" className="bg-gray-800 p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-100">App Health Monitor</h2>
              <button className="text-xs text-blue-600 hover:text-blue-800">
                <i className="fa-solid fa-sync mr-1"></i> Refresh
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-xs text-green-500">Supabase DB</span>
                </div>
                <span className="text-xs text-green-500">Operational</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-xs text-green-500">Edge Functions</span>
                </div>
                <span className="text-xs text-green-500">Operational</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                  <span className="text-xs text-yellow-500">PhantomBuster Queue</span>
                </div>
                <span className="text-xs text-yellow-500">Degraded</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-xs text-green-500">Slack Integration</span>
                </div>
                <span className="text-xs text-green-500">Operational</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-xs text-red-500">Zapier Integration</span>
                </div>
                <span className="text-xs text-red-500">Outage</span>
              </div>
            </div>
          </div>
          {/* Quick Actions */}
          <div id="quick-actions" className="bg-gray-800 p-4 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-100">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" onClick={() => navigate('/phantom/cookie-refresh')}>
                <i className="fa-solid fa-sync text-blue-600 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">Refresh Cookies</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" onClick={() => navigate('/admin/users')}>
                <i className="fa-solid fa-user-shield text-blue-600 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">User Management</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" onClick={() => navigate('/phantom/config')}>
                <i className="fa-solid fa-tasks text-blue-600 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">Phantom Tasks</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors">
                <i className="fa-solid fa-database text-blue-600 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">DB Console</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-red-900/30 rounded-md hover:bg-red-900/50 transition-colors col-span-2">
                <i className="fa-solid fa-power-off text-red-500 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">Emergency Stop</span>
              </button>
            </div>
          </div>
        </div>
        {/* Recent User Signups */}
        <div id="recent-signups" className="bg-gray-800 p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Recent User Signups</h2>
            <div className="flex space-x-2">
              <div className="relative">
                <input type="text" placeholder="Search users..." className="bg-gray-700 border border-gray-600 rounded-md py-1 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 w-64" />
                <i className="fa-solid fa-search absolute right-3 top-2 text-gray-400"></i>
              </div>
              <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm" onClick={() => navigate('/admin/users')}>
                View All
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Signup Source</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date Created</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-gray-700 divide-y divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : latestUser ? (
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-xs">{latestUser.firstName?.[0]}{latestUser.lastName?.[0]}</span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium">{latestUser.firstName} {latestUser.lastName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{latestUser.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-900 text-blue-200 rounded-full">{latestUser.role}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">Direct</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {new Date(latestUser.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800">
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        <button className="text-yellow-500 hover:text-yellow-400">
                          <i className="fa-solid fa-user-secret"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-400">
                      No recent signups
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* Cookie Session Monitor */}
        <div id="cookie-monitor" className="bg-gray-800 p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Cookie Session Monitor</h2>
            <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">
              <i className="fa-solid fa-sync mr-1"></i> Refresh All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Service</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Refreshed</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Expiration ETA</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-gray-700 divide-y divide-gray-700">
                {/* Example rows, replace with dynamic data */}
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">John Doe</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <i className="fa-brands fa-linkedin text-blue-500 mr-2"></i>
                      <span className="text-sm text-white">LinkedIn</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">Jun 12, 2023 (2 days ago)</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">12 days</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-green-900 text-green-200 rounded-full">Healthy</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
                      Refresh
                    </button>
                  </td>
                </tr>
                {/* Add more rows as needed */}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 