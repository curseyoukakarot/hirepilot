/**
 * Admin Proxy Management Screen
 * Complete proxy management interface for Super Admin
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  TestTube, 
  Shield, 
  Users, 
  TrendingUp,
  RefreshCw,
  Settings,
  Plus,
  Trash2,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const API_BASE_URL = `${(import.meta.env.VITE_BACKEND_URL || 'https://api.thehirepilot.com')}/api`;

// Components
import ProxyTestModal from '../components/admin/ProxyTestModal';
import ProxyHistoryModal from '../components/admin/ProxyHistoryModal';
import AddProxyModal from '../components/admin/AddProxyModal';
import ReassignProxyModal from '../components/admin/ReassignProxyModal';

const AdminProxyManagement = () => {
  // State
  const [proxies, setProxies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState({});
  const [filters, setFilters] = useState({
    status: '',
    provider: '',
    health_status: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Modals
  const [showTestModal, setShowTestModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedProxy, setSelectedProxy] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadProxies();
    loadStats();
  }, [filters, pagination.offset, sortBy, sortOrder]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadProxies();
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Load proxy list with filters
   */
  const loadProxies = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        ...filters,
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString()
      });
      
      // Remove empty filters
      Object.keys(filters).forEach(key => {
        if (!filters[key]) params.delete(key);
      });
      
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/admin/proxies?${params}`, {
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load proxies');
      }
      
      const result = await response.json();
      setProxies(result.data || []);
      setPagination(prev => ({ ...prev, total: result.pagination?.total || 0 }));
      
    } catch (error) {
      console.error('Error loading proxies:', error);
      toast.error('Failed to load proxies');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load proxy statistics
   */
  const loadStats = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/admin/proxies/stats`, {
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load stats');
      }
      
      const result = await response.json();
      setStats(result.data);
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  /**
   * Test individual proxy
   */
  const testProxy = async (proxyId) => {
    try {
      setTesting(prev => ({ ...prev, [proxyId]: true }));
      
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/admin/proxies/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ proxyId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to test proxy');
      }
      
      const result = await response.json();
      const testResult = result.data;
      
      if (testResult.success) {
        toast.success(`✅ Proxy test passed (${testResult.response_time_ms}ms)`);
      } else {
        toast.error(`❌ Proxy test failed: ${testResult.error_message}`);
      }
      
      // Show detailed results in modal
      setSelectedProxy({ id: proxyId, testResult });
      setShowTestModal(true);
      
      // Refresh proxy list
      await loadProxies();
      
    } catch (error) {
      console.error('Error testing proxy:', error);
      toast.error('Failed to test proxy');
    } finally {
      setTesting(prev => ({ ...prev, [proxyId]: false }));
    }
  };

  /**
   * Batch test multiple proxies
   */
  const batchTestProxies = async (proxyIds = null) => {
    try {
      const payload = proxyIds ? { proxy_ids: proxyIds } : { test_all: true };
      
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/admin/proxies/batch-test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error('Failed to start batch test');
      }
      
      const result = await response.json();
      toast.success(result.message);
      
      // Refresh after a delay
      setTimeout(loadProxies, 3000);
      
    } catch (error) {
      console.error('Error batch testing:', error);
      toast.error('Failed to start batch test');
    }
  };

  /**
   * Update proxy status
   */
  const updateProxyStatus = async (proxyId, status) => {
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/admin/proxies/${proxyId}/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      
      toast.success(`Proxy status updated to ${status}`);
      await loadProxies();
      
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update proxy status');
    }
  };

  /**
   * Delete proxy
   */
  const deleteProxy = async (proxyId) => {
    if (!confirm('Are you sure you want to delete this proxy? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE_URL}/admin/proxies/${proxyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete proxy');
      }
      
      toast.success('Proxy deleted successfully');
      await loadProxies();
      
    } catch (error) {
      console.error('Error deleting proxy:', error);
      toast.error('Failed to delete proxy');
    }
  };

  /**
   * Health status badge
   */
  const HealthStatusBadge = ({ status }) => {
    const configs = {
      healthy: { icon: CheckCircle, color: 'text-green-600 bg-green-50', text: 'Healthy' },
      warning: { icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50', text: 'Warning' },
      inactive: { icon: XCircle, color: 'text-red-600 bg-red-50', text: 'Inactive' }
    };
    
    const config = configs[status] || configs.inactive;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </span>
    );
  };

  /**
   * Status badge
   */
  const StatusBadge = ({ status }) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      banned: 'bg-red-100 text-red-800',
      testing: 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Proxy Management</h1>
            <p className="text-gray-600 mt-1">Manage and test all system proxies</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => batchTestProxies()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <TestTube className="w-4 h-4 mr-2" />
              Test All
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Proxy
            </button>
            <button
              onClick={loadProxies}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Panel */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Proxies</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_proxies || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Healthy</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_proxies || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Use</p>
                <p className="text-2xl font-bold text-gray-900">{stats.proxies_in_use || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avg_success_rate ? `${Math.round(stats.avg_success_rate)}%` : '0%'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by IP or user..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
              <option value="banned">Banned</option>
              <option value="testing">Testing</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Health</label>
            <select
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.health_status}
              onChange={(e) => setFilters(prev => ({ ...prev, health_status: e.target.value }))}
            >
              <option value="">All Health</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.provider}
              onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
            >
              <option value="">All Providers</option>
              <option value="smartproxy">SmartProxy</option>
              <option value="brightdata">BrightData</option>
              <option value="oxylabs">Oxylabs</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Proxy Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proxy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Health
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assignments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Test
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    <div className="flex justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : proxies.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    No proxies found
                  </td>
                </tr>
              ) : (
                proxies.map((proxy) => (
                  <tr key={proxy.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {proxy.endpoint}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Globe className="w-3 h-3 mr-1" />
                          {proxy.provider} • {proxy.country_code || 'Unknown'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={proxy.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <HealthStatusBadge status={proxy.health_status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {proxy.success_rate_percent !== null 
                          ? `${proxy.success_rate_percent}%` 
                          : 'No data'
                        }
                      </div>
                      <div className="text-sm text-gray-500">
                        ✓ {proxy.global_success_count || 0} / 
                        ✗ {proxy.global_failure_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {proxy.current_assignments || 0} / {proxy.max_concurrent_users}
                      </div>
                      {proxy.assigned_users && (
                        <div className="text-sm text-gray-500 truncate max-w-32">
                          {proxy.assigned_users}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {proxy.last_tested_at 
                          ? new Date(proxy.last_tested_at).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                      <div className="text-sm text-gray-500">
                        {proxy.last_test_success === true && '✅ Passed'}
                        {proxy.last_test_success === false && '❌ Failed'}
                        {proxy.last_test_success === null && '⚪ No data'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => testProxy(proxy.id)}
                          disabled={testing[proxy.id]}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title="Test Proxy"
                        >
                          {testing[proxy.id] ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <TestTube className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProxy(proxy);
                            setShowHistoryModal(true);
                          }}
                          className="text-gray-600 hover:text-gray-900"
                          title="View History"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProxy(proxy);
                            setShowReassignModal(true);
                          }}
                          className="text-purple-600 hover:text-purple-900"
                          title="Reassign"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteProxy(proxy.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ 
                  ...prev, 
                  offset: Math.max(0, prev.offset - prev.limit) 
                }))}
                disabled={pagination.offset === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ 
                  ...prev, 
                  offset: prev.offset + prev.limit 
                }))}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">{pagination.offset + 1}</span>
                  {' '}to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.offset + pagination.limit, pagination.total)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium">{pagination.total}</span>
                  {' '}results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination(prev => ({ 
                      ...prev, 
                      offset: Math.max(0, prev.offset - prev.limit) 
                    }))}
                    disabled={pagination.offset === 0}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ 
                      ...prev, 
                      offset: prev.offset + prev.limit 
                    }))}
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showTestModal && (
        <ProxyTestModal
          proxy={selectedProxy}
          onClose={() => setShowTestModal(false)}
        />
      )}
      
      {showHistoryModal && (
        <ProxyHistoryModal
          proxy={selectedProxy}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
      
      {showAddModal && (
        <AddProxyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadProxies();
          }}
        />
      )}
      
      {showReassignModal && (
        <ReassignProxyModal
          proxy={selectedProxy}
          onClose={() => setShowReassignModal(false)}
          onSuccess={() => {
            setShowReassignModal(false);
            loadProxies();
          }}
        />
      )}
    </div>
  );
};

export default AdminProxyManagement; 