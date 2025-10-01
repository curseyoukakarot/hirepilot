import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import AppHealthCard from '../components/AppHealthCard';
import AuthHealthCard from '../components/AuthHealthCard';
import REXChatToggleCard from '../components/REXChatToggleCard';
import useAppHealth from '../hooks/useAppHealth';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [latestUser, setLatestUser] = useState(null);
  const [totalCollaborators, setTotalCollaborators] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalCreditsUsed, setTotalCreditsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const { data: health } = useAppHealth();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const fetchLatestUsers = async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch(`${BACKEND_URL}/api/admin/latest-users`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        const users = await res.json();
        setLatestUser(users.slice(0,5));
        // Also fetch total collaborators sitewide
        const { count } = await supabase
          .from('job_guest_collaborators')
          .select('id', { count: 'exact', head: true });
        setTotalCollaborators(Number(count || 0));
      } catch (err) {
        console.error('Failed to fetch latest users:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestUsers();
  }, []);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const res = await fetch(`${BACKEND_URL}/api/admin/stats/overview`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch admin overview');
        const data = await res.json();
        setTotalUsers(Number(data.total_users) || 0);
        setTotalCreditsUsed(Number(data.total_credits_used) || 0);
      } catch (e) {
        console.error('Failed to fetch admin overview:', e);
      }
    };
    fetchOverview();
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
                  <span className="text-sm text-gray-200">Total Collaborators</span>
                  <span className="text-blue-600">
                    <i className="fa-solid fa-user-plus"></i>
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-gray-100">{totalCollaborators}</span>
                  <span className="text-gray-400 text-xs ml-2">All time</span>
                </div>
              </div>
              {/* Total Users mini card */}
              <div className="bg-gray-700 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-200">Total Users</span>
                  <span className="text-blue-600">
                    <i className="fa-solid fa-users"></i>
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-gray-100">{totalUsers}</span>
                  <span className="text-gray-400 text-xs ml-2">All time</span>
                </div>
              </div>
              <div className="bg-gray-700 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-200">Affiliate Partners</span>
                  <span className="text-blue-600">
                    <i className="fa-solid fa-handshake"></i>
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-gray-100">{health?.affiliates?.total ?? 0}</span>
                  <span className="text-gray-400 text-xs ml-2">Total</span>
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
                  <span className="text-2xl font-bold text-gray-100">{health?.failed?.today ?? 0}</span>
                  <span className="text-red-500 text-xs ml-2">Today</span>
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
                  <span className="text-2xl font-bold text-gray-100">{health?.api?.today ?? 0}</span>
                  <span className="text-gray-400 text-xs ml-2">Today</span>
                </div>
              </div>
              {/* Total Credit Consumption mini card */}
              <div className="bg-gray-700 p-3 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-200">Total Credit Consumption</span>
                  <span className="text-yellow-500">
                    <i className="fa-solid fa-coins"></i>
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-gray-100">{totalCreditsUsed}</span>
                  <span className="text-gray-400 text-xs ml-2">Used</span>
                </div>
              </div>
            </div>
          </div>
          {/* Auth Health */}
          <AuthHealthCard />
          {/* App Health Monitor */}
          <AppHealthCard />
          <div className="bg-gray-800 p-4 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-100">Assistant Configuration</h2>
            <div className="bg-white rounded-xl p-4">
              <REXChatToggleCard />
            </div>
          </div>
          {/* Quick Actions */}
          <div id="quick-actions" className="bg-gray-800 p-4 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-100">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" onClick={() => navigate('/admin/affiliates')}>
                <i className="fa-solid fa-handshake text-blue-600 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">Affiliate Manager</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" onClick={() => navigate('/admin/users')}>
                <i className="fa-solid fa-user-shield text-blue-600 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">User Management</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" onClick={() => navigate('/super-admin/sourcing')}>
                <i className="fa-solid fa-diagram-project text-blue-600 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">Sourcing Campaigns</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" onClick={() => navigate('/super-admin/inbox')}>
                <i className="fa-solid fa-inbox text-blue-600 text-xl mb-2"></i>
                <span className="text-sm text-gray-200">Action Inbox</span>
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
                ) : Array.isArray(latestUser) && latestUser.length ? (
                  latestUser.map((u)=> (
                  <tr key={u.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-xs">{(u.firstName||u.first_name||'')[0]}{(u.lastName||u.last_name||'')[0]}</span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium">{u.firstName||u.first_name} {u.lastName||u.last_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-900 text-blue-200 rounded-full">{u.role}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">Direct</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
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
                  ))
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
        {/* Cookie Session Monitor removed */}
      </div>
    </div>
  );
} 