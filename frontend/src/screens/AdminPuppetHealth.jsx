import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert } from '../components/ui/alert';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Users, Zap, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

// API hook for fetching puppet health data
const usePuppetHealthData = (endpoint, refreshInterval = 30000) => {
  return useQuery({
    queryKey: ['puppet-health', endpoint],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE_URL}/puppet/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}`);
      }
      return response.json();
    },
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
    staleTime: 15000, // Consider data stale after 15 seconds
  });
};

// Utility components
const StatCard = ({ title, value, icon: Icon, color = "blue", subtitle, trend }) => (
  <Card className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        {trend && (
          <p className={`text-xs mt-1 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '+' : ''}{trend}% from yesterday
          </p>
        )}
      </div>
      <div className={`p-3 bg-${color}-100 rounded-lg`}>
        <Icon className={`h-6 w-6 text-${color}-600`} />
      </div>
    </div>
  </Card>
);

const StatusBadge = ({ status, children }) => {
  const statusColors = {
    healthy: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
    inactive: 'bg-gray-100 text-gray-800',
    unhealthy: 'bg-red-100 text-red-800'
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || statusColors.inactive}`}>
      {children || status}
    </span>
  );
};

// Main Dashboard Component
const AdminPuppetHealth = () => {
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds default
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch data from all endpoints
  const jobsQuery = usePuppetHealthData('stats/jobs', refreshInterval);
  const proxiesQuery = usePuppetHealthData('stats/proxies', refreshInterval);
  const warmupQuery = usePuppetHealthData('stats/warmup-tiers', refreshInterval);
  const dedupQuery = usePuppetHealthData('stats/deduped-invites', refreshInterval);
  const summaryQuery = usePuppetHealthData('stats/summary', refreshInterval);

  const isLoading = jobsQuery.isLoading || proxiesQuery.isLoading || warmupQuery.isLoading || dedupQuery.isLoading || summaryQuery.isLoading;
  const hasError = jobsQuery.error || proxiesQuery.error || warmupQuery.error || dedupQuery.error || summaryQuery.error;

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleManualRefresh = () => {
    jobsQuery.refetch();
    proxiesQuery.refetch();
    warmupQuery.refetch();
    dedupQuery.refetch();
    summaryQuery.refetch();
    setLastRefresh(new Date());
  };

  if (hasError) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <div>
            <h3 className="text-red-800 font-medium">Failed to load dashboard data</h3>
            <p className="text-red-700 text-sm mt-1">
              {jobsQuery.error?.message || proxiesQuery.error?.message || 'Unknown error occurred'}
            </p>
            <Button 
              onClick={handleManualRefresh} 
              className="mt-2 bg-red-600 hover:bg-red-700"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Puppet System Health</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring and system status</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <select 
            value={refreshInterval} 
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value={15000}>15s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>
          <Button onClick={handleManualRefresh} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Summary */}
      {summaryQuery.data?.success && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">System Health Summary</h2>
            <StatusBadge status={summaryQuery.data.data.system_status}>
              {summaryQuery.data.data.system_status.toUpperCase()}
            </StatusBadge>
          </div>
          
          {/* Alerts */}
          {summaryQuery.data.data.alerts && summaryQuery.data.data.alerts.length > 0 && (
            <div className="mb-6 space-y-2">
              {summaryQuery.data.data.alerts.map((alert, index) => (
                <Alert key={index} className={`border-${alert.type === 'error' ? 'red' : alert.type === 'warning' ? 'yellow' : 'blue'}-200`}>
                  <AlertTriangle className={`h-4 w-4 text-${alert.type === 'error' ? 'red' : alert.type === 'warning' ? 'yellow' : 'blue'}-600`} />
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm opacity-75">Metric: {alert.metric} = {alert.value}</p>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Job Success Rate"
              value={`${summaryQuery.data.data.metrics.job_success_rate}%`}
              icon={CheckCircle}
              color={summaryQuery.data.data.metrics.job_success_rate >= 80 ? "green" : summaryQuery.data.data.metrics.job_success_rate >= 60 ? "yellow" : "red"}
              subtitle="Last 24 hours"
            />
            <StatCard
              title="Failed Proxies"
              value={`${summaryQuery.data.data.metrics.failed_proxies}/${summaryQuery.data.data.metrics.total_proxies}`}
              icon={Shield}
              color={summaryQuery.data.data.metrics.failed_proxies / summaryQuery.data.data.metrics.total_proxies < 0.3 ? "green" : "yellow"}
              subtitle="Active proxy health"
            />
            <StatCard
              title="Retry Success Rate"
              value={`${summaryQuery.data.data.metrics.retry_success_rate}%`}
              icon={RefreshCw}
              color={summaryQuery.data.data.metrics.retry_success_rate >= 60 ? "green" : "yellow"}
              subtitle="Automatic retry recovery"
            />
            <StatCard
              title="Dedup Blocks"
              value={summaryQuery.data.data.metrics.dedup_blocks_24h}
              icon={Shield}
              color="blue"
              subtitle="Last 24 hours"
            />
          </div>
        </Card>
      )}

      {/* Job Queue Panel */}
      {jobsQuery.data?.success && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Job Queue Status</h2>
            <div className="text-sm text-gray-500">
              Total: {jobsQuery.data.data.total} jobs
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard
              title="Pending"
              value={jobsQuery.data.data.pending}
              icon={Clock}
              color="yellow"
            />
            <StatCard
              title="In Progress"
              value={jobsQuery.data.data.in_progress}
              icon={Zap}
              color="blue"
            />
            <StatCard
              title="Completed"
              value={jobsQuery.data.data.completed}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              title="Failed"
              value={jobsQuery.data.data.failed}
              icon={XCircle}
              color="red"
            />
            <StatCard
              title="Retry Queue"
              value={jobsQuery.data.data.retry_backlog}
              icon={RefreshCw}
              color="orange"
              subtitle={`${jobsQuery.data.data.retry_jobs_ready} ready now`}
            />
          </div>

          {/* Hourly Trend Chart (Simple Bar Visualization) */}
          {jobsQuery.data.data.hourly_trend && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">24-Hour Job Trend</h3>
              <div className="flex items-end space-x-1 h-32">
                {jobsQuery.data.data.hourly_trend.map((hour, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="flex flex-col w-full space-y-1">
                      <div 
                        className="bg-green-500 rounded-t"
                        style={{ height: `${(hour.completed / Math.max(...jobsQuery.data.data.hourly_trend.map(h => h.total))) * 100}px` }}
                        title={`Hour ${hour.hour}: ${hour.completed} completed`}
                      />
                      <div 
                        className="bg-red-500 rounded-b"
                        style={{ height: `${(hour.failed / Math.max(...jobsQuery.data.data.hourly_trend.map(h => h.total))) * 100}px` }}
                        title={`Hour ${hour.hour}: ${hour.failed} failed`}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{hour.hour}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center space-x-4 mt-2 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                  <span>Completed</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                  <span>Failed</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Proxy Health Panel */}
      {proxiesQuery.data?.success && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Proxy Health Status</h2>
            <div className="text-sm text-gray-500">
              {proxiesQuery.data.data.summary.healthy_proxies}/{proxiesQuery.data.data.summary.total_proxies} healthy
            </div>
          </div>

          {/* Proxy Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Healthy"
              value={proxiesQuery.data.data.summary.healthy_proxies}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              title="Warning"
              value={proxiesQuery.data.data.summary.warning_proxies}
              icon={AlertTriangle}
              color="yellow"
            />
            <StatCard
              title="Unhealthy"
              value={proxiesQuery.data.data.summary.unhealthy_proxies}
              icon={XCircle}
              color="red"
            />
            <StatCard
              title="Inactive"
              value={proxiesQuery.data.data.summary.inactive_proxies}
              icon={Clock}
              color="gray"
            />
          </div>

          {/* Proxy Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proxy ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success/Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proxiesQuery.data.data.proxies.slice(0, 10).map((proxy) => (
                  <tr key={proxy.proxy_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {proxy.proxy_id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {proxy.assigned_user}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {proxy.success_count}/{proxy.total_jobs}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {proxy.success_rate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={proxy.health_status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(proxy.last_used).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {proxiesQuery.data.data.proxies.length > 10 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing 10 of {proxiesQuery.data.data.proxies.length} proxies
            </div>
          )}
        </Card>
      )}

      {/* Warm-Up Tier Tracker */}
      {warmupQuery.data?.success && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Warm-Up Tier Status</h2>
            <div className="text-sm text-gray-500">
              {warmupQuery.data.data.summary.auto_advance_ready} users ready for advancement
            </div>
          </div>

          {/* Tier Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Tier 1"
              value={warmupQuery.data.data.summary.users_by_tier.tier_1}
              icon={Users}
              color="blue"
              subtitle="Getting started"
            />
            <StatCard
              title="Tier 2"
              value={warmupQuery.data.data.summary.users_by_tier.tier_2}
              icon={Users}
              color="green"
              subtitle="Building trust"
            />
            <StatCard
              title="Tier 3"
              value={warmupQuery.data.data.summary.users_by_tier.tier_3}
              icon={Users}
              color="yellow"
              subtitle="Established"
            />
            <StatCard
              title="Tier 4+"
              value={warmupQuery.data.data.summary.users_by_tier.tier_4_plus}
              icon={Users}
              color="purple"
              subtitle="Full capacity"
            />
          </div>

          {/* User Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Daily Limit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days in Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Auto-Advance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {warmupQuery.data.data.users.slice(0, 10).map((user, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.user_email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Tier {user.current_tier}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.daily_limit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.success_rate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.days_in_tier}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={user.auto_advance_eligible ? 'healthy' : 'inactive'}>
                        {user.auto_advance_eligible ? 'Yes' : 'No'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Deduplication Warnings Panel */}
      {dedupQuery.data?.success && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Deduplication Activity</h2>
            <div className="text-sm text-gray-500">
              {dedupQuery.data.data.summary.total_blocked} blocked invites
            </div>
          </div>

          {/* Dedup Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              title="Total Blocked"
              value={dedupQuery.data.data.summary.total_blocked}
              icon={Shield}
              color="blue"
              subtitle="Last 24 hours"
            />
            <StatCard
              title="Active Cooldowns"
              value={dedupQuery.data.data.summary.active_cooldowns}
              icon={Clock}
              color="yellow"
              subtitle="Still in cooldown"
            />
            <StatCard
              title="Top Rule"
              value={Object.keys(dedupQuery.data.data.summary.rule_breakdown)[0] || 'None'}
              icon={AlertTriangle}
              color="red"
              subtitle={`${Object.values(dedupQuery.data.data.summary.rule_breakdown)[0] || 0} blocks`}
            />
          </div>

          {/* Recent Blocks Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profile URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rule Triggered
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Blocked At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cooldown Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dedupQuery.data.data.warnings.slice(0, 10).map((warning, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <a href={warning.profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                        {warning.profile_url.split('/').pop()}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {warning.user_email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {warning.rule_triggered}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(warning.blocked_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={warning.cooldown_active ? 'warning' : 'healthy'}>
                        {warning.cooldown_active ? `${warning.days_until_retry} days left` : 'Expired'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mr-3" />
          <span className="text-lg text-gray-600">Loading dashboard data...</span>
        </div>
      )}
    </div>
  );
};

export default AdminPuppetHealth; 