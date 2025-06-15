import React, { useState } from 'react';
import { FaArrowUp, FaArrowDown } from 'react-icons/fa';
// @ts-ignore
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const mockSummary = {
  totalAccounts: 42,
  activeRuns: 7,
  failedRuns: 3,
  cooldowns: 2,
  mostActiveProxy: 'US (Virginia)',
  trends: {
    totalAccounts: 1,
    activeRuns: -1,
    failedRuns: 0,
    cooldowns: 1,
    mostActiveProxy: 0
  }
};

const mockRunVolume = [
  { date: '2024-06-01', success: 10, fail: 2 },
  { date: '2024-06-02', success: 12, fail: 1 },
  { date: '2024-06-03', success: 8, fail: 3 },
  { date: '2024-06-04', success: 15, fail: 0 },
  { date: '2024-06-05', success: 11, fail: 2 },
  { date: '2024-06-06', success: 14, fail: 1 },
  { date: '2024-06-07', success: 13, fail: 2 },
];

const mockPhantomTypes = [
  { name: 'Sales Nav Export', value: 20 },
  { name: 'Profile Scraper', value: 15 },
  { name: 'Auto-Connect', value: 10 },
];

const mockErrorTypes = [
  { date: '2024-06-01', cookie: 1, login: 0, proxy: 1, rate: 0 },
  { date: '2024-06-02', cookie: 0, login: 1, proxy: 0, rate: 1 },
  { date: '2024-06-03', cookie: 2, login: 0, proxy: 1, rate: 0 },
  { date: '2024-06-04', cookie: 0, login: 1, proxy: 0, rate: 1 },
  { date: '2024-06-05', cookie: 1, login: 0, proxy: 1, rate: 0 },
];

const mockWarnings = [
  { account: 'user1@company.com', warnings: 5 },
  { account: 'user2@company.com', warnings: 3 },
  { account: 'user3@company.com', warnings: 2 },
];

const mockProxies = [
  { proxy: 'US (Virginia)', location: 'US', type: 'residential', accounts: 5, lastUsed: '2024-06-06', errorCount: 1, health: 'unstable' },
  { proxy: 'DE (Frankfurt)', location: 'DE', type: 'internal', accounts: 3, lastUsed: '2024-06-05', errorCount: 0, health: 'healthy' },
];

const mockFailedRuns = [
  { date: '2024-06-06', account: 'user1@company.com', phantom: 'Profile Scraper', error: 'cookie expired', proxy: 'US (Virginia)', cookieAge: 12, notes: 'Session expired' },
  { date: '2024-06-05', account: 'user2@company.com', phantom: 'Sales Nav Export', error: 'proxy error', proxy: 'DE (Frankfurt)', cookieAge: 5, notes: 'Proxy timeout' },
];

const mockCooldowns = [
  { account: 'user1@company.com', reason: 'rate limit', duration: '15m', who: 'admin', until: '2024-06-07 10:00' },
];

export default function LinkedInAnalytics() {
  const [showCooldown, setShowCooldown] = useState(false);
  const [proxyErrorOnly, setProxyErrorOnly] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">LinkedIn Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <SummaryCard label="Total LinkedIn Accounts" value={mockSummary.totalAccounts} trend={mockSummary.trends.totalAccounts} />
        <SummaryCard label="Active Phantom Runs Today" value={mockSummary.activeRuns} trend={mockSummary.trends.activeRuns} />
        <SummaryCard label="Failed Runs (24h)" value={mockSummary.failedRuns} trend={mockSummary.trends.failedRuns} />
        <SummaryCard label="Accounts in Cooldown" value={mockSummary.cooldowns} trend={mockSummary.trends.cooldowns} />
        <SummaryCard label="Most Active Proxy" value={mockSummary.mostActiveProxy} trend={mockSummary.trends.mostActiveProxy} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-bold mb-2 text-blue-700">Daily Phantom Run Volume</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mockRunVolume} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="success" stroke="#22c55e" name="Success" />
              <Line type="monotone" dataKey="fail" stroke="#ef4444" name="Fail" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-bold mb-2 text-blue-700">Top Phantom Types Used</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={mockPhantomTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                {mockPhantomTypes.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={["#2563eb", "#22c55e", "#f59e42"][idx % 3]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl shadow p-4 col-span-2">
          <h2 className="font-bold mb-2 text-blue-700">Error Types Over Time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockErrorTypes} stackOffset="expand">
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="cookie" stackId="1" stroke="#f59e42" fill="#f59e42" name="Cookie Expired" />
              <Area type="monotone" dataKey="login" stackId="1" stroke="#ef4444" fill="#ef4444" name="Login Blocked" />
              <Area type="monotone" dataKey="proxy" stackId="1" stroke="#2563eb" fill="#2563eb" name="Proxy Error" />
              <Area type="monotone" dataKey="rate" stackId="1" stroke="#22c55e" fill="#22c55e" name="Rate Limited" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl shadow p-4 col-span-2">
          <h2 className="font-bold mb-2 text-blue-700">Accounts with Most Warnings</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockWarnings} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="account" type="category" />
              <Tooltip />
              <Legend />
              <Bar dataKey="warnings" fill="#ef4444" name="Warnings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-4 mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-blue-700">Proxy Health Log</h2>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={proxyErrorOnly} onChange={e => setProxyErrorOnly(e.target.checked)} />
            Show only proxies with errors
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-2 py-1">Proxy</th>
                <th className="px-2 py-1">Location</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1"># Accounts</th>
                <th className="px-2 py-1">Last Used</th>
                <th className="px-2 py-1">Error Count</th>
                <th className="px-2 py-1">Health Status</th>
              </tr>
            </thead>
            <tbody>
              {(proxyErrorOnly ? mockProxies.filter(p => p.errorCount > 0) : mockProxies).map((p, i) => (
                <tr key={i} className={p.errorCount > 0 ? 'bg-red-50' : ''}>
                  <td className="px-2 py-1 font-mono">{p.proxy}</td>
                  <td className="px-2 py-1">{p.location}</td>
                  <td className="px-2 py-1">{p.type}</td>
                  <td className="px-2 py-1 text-center">{p.accounts}</td>
                  <td className="px-2 py-1">{p.lastUsed}</td>
                  <td className="px-2 py-1 text-center">{p.errorCount}</td>
                  <td className="px-2 py-1">{p.health}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-4 mb-8">
        <h2 className="font-bold text-blue-700 mb-2">Failed Run Logs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-2 py-1">Date</th>
                <th className="px-2 py-1">LinkedIn Account</th>
                <th className="px-2 py-1">Phantom</th>
                <th className="px-2 py-1">Error Type</th>
                <th className="px-2 py-1">Proxy</th>
                <th className="px-2 py-1">Cookie Age</th>
                <th className="px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {mockFailedRuns.map((r, i) => (
                <tr key={i} className="bg-red-50">
                  <td className="px-2 py-1 font-mono">{r.date}</td>
                  <td className="px-2 py-1">{r.account}</td>
                  <td className="px-2 py-1">{r.phantom}</td>
                  <td className="px-2 py-1">{r.error}</td>
                  <td className="px-2 py-1">{r.proxy}</td>
                  <td className="px-2 py-1 text-center">{r.cookieAge}</td>
                  <td className="px-2 py-1">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow p-4 mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-blue-700">Cooldown History <span className="text-xs text-slate-400">(Optional)</span></h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-2 py-1">Account</th>
                <th className="px-2 py-1">Trigger Reason</th>
                <th className="px-2 py-1">Duration</th>
                <th className="px-2 py-1">Who Reset</th>
                <th className="px-2 py-1">Time Until Reactivation</th>
              </tr>
            </thead>
            <tbody>
              {mockCooldowns.map((c, i) => (
                <tr key={i}>
                  <td className="px-2 py-1">{c.account}</td>
                  <td className="px-2 py-1">{c.reason}</td>
                  <td className="px-2 py-1">{c.duration}</td>
                  <td className="px-2 py-1">{c.who}</td>
                  <td className="px-2 py-1">{c.until}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, trend }: { label: string; value: any; trend: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col items-center justify-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-blue-800">{value}</div>
      <div className="flex items-center gap-1 mt-1">
        {trend > 0 && <FaArrowUp className="text-green-500" />} 
        {trend < 0 && <FaArrowDown className="text-red-500" />} 
        <span className={`text-xs ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-slate-400'}`}>{trend > 0 ? '+' : ''}{trend}%</span>
      </div>
    </div>
  );
} 