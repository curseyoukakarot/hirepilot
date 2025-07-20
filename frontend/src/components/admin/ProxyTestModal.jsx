/**
 * Proxy Test Result Modal
 * Shows detailed results of proxy testing
 */

import React from 'react';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Globe, 
  AlertTriangle,
  Eye,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const ProxyTestModal = ({ proxy, onClose }) => {
  const testResult = proxy?.testResult;
  
  if (!testResult) {
    return null;
  }

  /**
   * Copy text to clipboard
   */
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  /**
   * Format response time
   */
  const formatResponseTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  /**
   * Get error type display info
   */
  const getErrorTypeInfo = (errorType) => {
    const types = {
      timeout: { color: 'text-yellow-600', label: 'Timeout', icon: Clock },
      blocked: { color: 'text-red-600', label: 'Blocked', icon: XCircle },
      captcha: { color: 'text-orange-600', label: 'CAPTCHA', icon: AlertTriangle },
      banned: { color: 'text-red-700', label: 'Banned', icon: XCircle },
      network_error: { color: 'text-purple-600', label: 'Network Error', icon: Globe },
      other: { color: 'text-gray-600', label: 'Other Error', icon: AlertTriangle }
    };
    
    return types[errorType] || types.other;
  };

  const errorInfo = testResult.error_type ? getErrorTypeInfo(testResult.error_type) : null;
  const ErrorIcon = errorInfo?.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Proxy Test Results</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Test Status */}
        <div className="mb-6">
          <div className="flex items-center mb-2">
            {testResult.success ? (
              <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 mr-2" />
            )}
            <span className={`text-lg font-semibold ${
              testResult.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {testResult.success ? 'Test Passed' : 'Test Failed'}
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            Tested on {new Date(testResult.timestamp).toLocaleString()}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-700 mb-1">Response Time</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatResponseTime(testResult.response_time_ms)}
            </div>
          </div>
          
          {testResult.status_code && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-1">Status Code</div>
              <div className={`text-2xl font-bold ${
                testResult.status_code === 200 ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult.status_code}
              </div>
            </div>
          )}
        </div>

        {/* Error Information */}
        {!testResult.success && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Error Details</h3>
            
            {testResult.error_type && (
              <div className="flex items-center mb-2">
                {ErrorIcon && <ErrorIcon className={`w-5 h-5 mr-2 ${errorInfo.color}`} />}
                <span className={`font-medium ${errorInfo.color}`}>
                  {errorInfo.label}
                </span>
              </div>
            )}
            
            {testResult.error_message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm text-red-800">
                  {testResult.error_message}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test Details */}
        {testResult.details && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Test Details</h3>
            
            <div className="space-y-3">
              {testResult.details.page_title && (
                <div className="flex items-start">
                  <div className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">
                    Page Title:
                  </div>
                  <div className="text-sm text-gray-900 flex-1 flex items-center">
                    {testResult.details.page_title}
                    <button
                      onClick={() => copyToClipboard(testResult.details.page_title)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {testResult.details.final_url && (
                <div className="flex items-start">
                  <div className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">
                    Final URL:
                  </div>
                  <div className="text-sm text-gray-900 flex-1 flex items-center">
                    <a 
                      href={testResult.details.final_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 break-all"
                    >
                      {testResult.details.final_url}
                    </a>
                    <ExternalLink className="w-4 h-4 ml-1 text-gray-400" />
                    <button
                      onClick={() => copyToClipboard(testResult.details.final_url)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {testResult.details.ip_address && (
                <div className="flex items-start">
                  <div className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">
                    IP Address:
                  </div>
                  <div className="text-sm text-gray-900 flex-1 flex items-center">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                      {testResult.details.ip_address}
                    </code>
                    <button
                      onClick={() => copyToClipboard(testResult.details.ip_address)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="flex items-start">
                <div className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">
                  User Agent:
                </div>
                <div className="text-sm text-gray-900 flex-1 flex items-center">
                  <span className="break-all">{testResult.details.user_agent}</span>
                  <button
                    onClick={() => copyToClipboard(testResult.details.user_agent)}
                    className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {testResult.details.screenshot_url && (
                <div className="flex items-start">
                  <div className="text-sm font-medium text-gray-700 w-24 flex-shrink-0">
                    Screenshot:
                  </div>
                  <div className="text-sm text-gray-900 flex-1">
                    <button className="flex items-center text-blue-600 hover:text-blue-800">
                      <Eye className="w-4 h-4 mr-1" />
                      View Screenshot
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Indicators */}
        {testResult.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <div className="text-sm text-green-800">
                <div className="font-medium">LinkedIn Access Successful</div>
                <div className="mt-1">
                  The proxy successfully loaded LinkedIn and all security checks passed.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {!testResult.success && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-2">Recommendations:</div>
                <ul className="list-disc list-inside space-y-1">
                  {testResult.error_type === 'timeout' && (
                    <li>Check proxy server response time and network connectivity</li>
                  )}
                  {testResult.error_type === 'blocked' && (
                    <li>Proxy may be blocked by LinkedIn - consider rotation</li>
                  )}
                  {testResult.error_type === 'captcha' && (
                    <li>CAPTCHA detected - proxy may be flagged, try different endpoint</li>
                  )}
                  {testResult.error_type === 'banned' && (
                    <li>Proxy appears to be banned - remove from active pool</li>
                  )}
                  {testResult.error_type === 'network_error' && (
                    <li>Network connectivity issue - check proxy configuration</li>
                  )}
                  <li>Test again in a few minutes to confirm issue persistence</li>
                  <li>Monitor proxy health metrics for patterns</li>
                </ul>
              </div>
            </div>
          </div>
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
            onClick={() => {
              // Copy full test result as JSON
              copyToClipboard(JSON.stringify(testResult, null, 2));
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Test Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProxyTestModal; 