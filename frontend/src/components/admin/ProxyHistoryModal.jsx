/**
 * Proxy Test History Modal
 * Shows historical test results and statistics for a proxy
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';

const ProxyHistoryModal = ({ proxy, onClose }) => {
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (proxy?.id) {
      loadHistory();
    }
  }, [proxy?.id]);

  /**
   * Load proxy test history
   */
  const loadHistory = async () => {
    try {
      setLoading(true);
      
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/proxies/${proxy.id}/history?limit=50`, {
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load history');
      }
      
      const result = await response.json();
      setHistory(result.data.history || []);
      setSummary(result.data.summary);
      
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Failed to load proxy history');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format response time
   */
  const formatResponseTime = (ms) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  /**
   * Get error type badge
   */
  const ErrorTypeBadge = ({ errorType }) => {
    if (!errorType) return null;
    
    const types = {
      timeout: { color: 'bg-yellow-100 text-yellow-800', label: 'Timeout' },
      blocked: { color: 'bg-red-100 text-red-800', label: 'Blocked' },
      captcha: { color: 'bg-orange-100 text-orange-800', label: 'CAPTCHA' },
      banned: { color: 'bg-red-200 text-red-900', label: 'Banned' },
      network_error: { color: 'bg-purple-100 text-purple-800', label: 'Network' },
      other: { color: 'bg-gray-100 text-gray-800', label: 'Other' }
    };
    
    const type = types[errorType] || types.other;
    
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${type.color}`}>
        {type.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Proxy Test History</h2>
            <p className="text-sm text-gray-600">{proxy?.endpoint}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Summary Statistics */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center">
                    <Activity className="w-6 h-6 text-blue-600 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-blue-700">Total Tests</div>
                      <div className="text-xl font-bold text-blue-900">
                        {summary.total_tests || 0}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center">
                    <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-green-700">Success Rate</div>
                      <div className="text-xl font-bold text-green-900">
                        {summary.success_rate ? `${summary.success_rate}%` : '0%'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center">
                    <Clock className="w-6 h-6 text-purple-600 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-purple-700">Avg Response</div>
                      <div className="text-xl font-bold text-purple-900">
                        {formatResponseTime(summary.avg_response_time)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center">
                    <Calendar className="w-6 h-6 text-gray-600 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Last Test</div>
                      <div className="text-lg font-bold text-gray-900">
                        {summary.last_test_at 
                          ? new Date(summary.last_test_at).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Common Error Types */}
            {summary?.common_error_types && Object.keys(summary.common_error_types).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Common Error Types</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(summary.common_error_types).map(([errorType, count]) => (
                      <div key={errorType} className="flex items-center justify-between">
                        <ErrorTypeBadge errorType={errorType} />
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Test History Table */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Tests</h3>
              
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No test history available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Result
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Response Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Error Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {history.map((test, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {new Date(test.tested_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {test.success ? (
                              <div className="flex items-center text-green-600">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                <span className="text-sm font-medium">Pass</span>
                              </div>
                            ) : (
                              <div className="flex items-center text-red-600">
                                <XCircle className="w-4 h-4 mr-1" />
                                <span className="text-sm font-medium">Fail</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatResponseTime(test.response_time_ms)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <ErrorTypeBadge errorType={test.error_type} />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                            {test.error_message || test.test_details?.page_title || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Performance Trends */}
            {history.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Trend</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-gray-700">
                        Recent {Math.min(history.length, 10)} tests:
                      </span>
                    </div>
                    <div className="flex space-x-4">
                      <div className="text-sm">
                        <span className="text-green-600 font-medium">
                          {history.slice(0, 10).filter(t => t.success).length} passed
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-red-600 font-medium">
                          {history.slice(0, 10).filter(t => !t.success).length} failed
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Simple visual indicator */}
                  <div className="mt-3 flex space-x-1">
                    {history.slice(0, 20).map((test, index) => (
                      <div
                        key={index}
                        className={`w-3 h-3 rounded-full ${
                          test.success ? 'bg-green-400' : 'bg-red-400'
                        }`}
                        title={`${new Date(test.tested_at).toLocaleString()} - ${
                          test.success ? 'Pass' : 'Fail'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {summary && summary.success_rate < 80 && (
              <div className="mb-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <div className="font-medium mb-2">Performance Concerns Detected</div>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Success rate below 80% - consider investigation</li>
                        {summary.success_rate < 50 && (
                          <li>Critical: Success rate below 50% - immediate attention required</li>
                        )}
                        <li>Monitor for patterns in error types</li>
                        <li>Consider rotating this proxy if issues persist</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={loadHistory}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProxyHistoryModal; 