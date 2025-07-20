/**
 * Add Proxy Modal
 * Form for adding new proxies to the system
 */

import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const AddProxyModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    provider: '',
    endpoint: '',
    username: '',
    password: '',
    country_code: '',
    region: '',
    city: '',
    proxy_type: 'residential',
    max_concurrent_users: 2
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  /**
   * Handle form input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'max_concurrent_users' ? parseInt(value) || 1 : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.provider.trim()) {
      newErrors.provider = 'Provider is required';
    }
    
    if (!formData.endpoint.trim()) {
      newErrors.endpoint = 'Endpoint is required';
    } else if (!isValidEndpoint(formData.endpoint)) {
      newErrors.endpoint = 'Invalid endpoint format (expected host:port)';
    }
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    }
    
    if (formData.max_concurrent_users < 1 || formData.max_concurrent_users > 10) {
      newErrors.max_concurrent_users = 'Must be between 1 and 10';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Check if endpoint format is valid
   */
  const isValidEndpoint = (endpoint) => {
    // Basic validation for host:port format
    const regex = /^[a-zA-Z0-9.-]+:\d+$/;
    return regex.test(endpoint);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/proxies/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to add proxy');
      }
      
      const result = await response.json();
      toast.success('Proxy added successfully');
      onSuccess?.(result.data);
      
    } catch (error) {
      console.error('Error adding proxy:', error);
      toast.error(error.message || 'Failed to add proxy');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Input field component
   */
  const InputField = ({ 
    label, 
    name, 
    type = 'text', 
    required = false, 
    placeholder = '', 
    ...props 
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={formData[name]}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          errors[name] ? 'border-red-300' : 'border-gray-300'
        }`}
        {...props}
      />
      {errors[name] && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1" />
          {errors[name]}
        </p>
      )}
    </div>
  );

  /**
   * Select field component
   */
  const SelectField = ({ label, name, options, required = false }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={formData[name]}
        onChange={handleChange}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          errors[name] ? 'border-red-300' : 'border-gray-300'
        }`}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors[name] && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1" />
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add New Proxy</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Provider & Endpoint */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField
              label="Provider"
              name="provider"
              required
              options={[
                { value: '', label: 'Select Provider' },
                { value: 'smartproxy', label: 'SmartProxy' },
                { value: 'brightdata', label: 'BrightData' },
                { value: 'oxylabs', label: 'Oxylabs' },
                { value: 'netnut', label: 'NetNut' },
                { value: 'soax', label: 'SOAX' },
                { value: 'other', label: 'Other' }
              ]}
            />
            
            <InputField
              label="Endpoint"
              name="endpoint"
              required
              placeholder="proxy.example.com:8000"
            />
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Username"
              name="username"
              required
              placeholder="proxy_username"
            />
            
            <InputField
              label="Password"
              name="password"
              type="password"
              required
              placeholder="proxy_password"
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField
              label="Country Code"
              name="country_code"
              placeholder="US"
              maxLength={2}
            />
            
            <InputField
              label="Region"
              name="region"
              placeholder="California"
            />
            
            <InputField
              label="City"
              name="city"
              placeholder="Los Angeles"
            />
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField
              label="Proxy Type"
              name="proxy_type"
              options={[
                { value: 'residential', label: 'Residential' },
                { value: 'datacenter', label: 'Datacenter' },
                { value: 'mobile', label: 'Mobile' }
              ]}
            />
            
            <InputField
              label="Max Concurrent Users"
              name="max_concurrent_users"
              type="number"
              min="1"
              max="10"
            />
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">Proxy Setup Notes:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>New proxies will be added with "testing" status</li>
                  <li>Test the proxy after adding to verify functionality</li>
                  <li>Endpoint format should be host:port (e.g., proxy.example.com:8000)</li>
                  <li>Max concurrent users determines assignment capacity</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Proxy
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProxyModal; 