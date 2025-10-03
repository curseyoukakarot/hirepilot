import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function LogActivityModal({ lead, onClose, onActivityAdded, entityType = 'lead' }) {
  const [formData, setFormData] = useState({
    activity_type: 'Call',
    tags: '',
    notes: '',
    activity_timestamp: new Date().toISOString().slice(0, 16) // Format for datetime-local input
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activityTypes = [
    { value: 'Call', label: 'Call', icon: '📞' },
    { value: 'Meeting', label: 'Meeting', icon: '🤝' },
    { value: 'Outreach', label: 'Outreach', icon: '📨' },
    { value: 'Email', label: 'Email Sent', icon: '✉️' },
    { value: 'LinkedIn', label: 'LinkedIn Request', icon: '💼' },
    { value: 'Note', label: 'Note', icon: '📝' },
    { value: 'Other', label: 'Other', icon: '📋' }
  ];

  // Helper to get auth headers
  const getAuthHeaders = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Parse tags from comma-separated string
      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // Determine correct lead id. If logging from a candidate drawer, the
      // lead id is provided via lead.lead_id
      const resolvedLeadId = entityType === 'candidate' ? (lead?.lead_id || null) : (lead?.id || null);

      const headers = await getAuthHeaders();
      let response;
      if (resolvedLeadId) {
        const activityData = {
          lead_id: resolvedLeadId,
          activity_type: formData.activity_type,
          tags: tags.length > 0 ? tags : [],
          notes: formData.notes.trim() || null,
          activity_timestamp: new Date(formData.activity_timestamp).toISOString()
        };
        response = await fetch(`${API_BASE_URL}/lead-activities`, {
          method: 'POST', headers, credentials: 'include', body: JSON.stringify(activityData)
        });
      } else if (entityType === 'candidate' && lead?.id) {
        // Fallback: log as candidate activity when no linked lead exists
        const candidatePayload = {
          candidate_id: lead.id,
          activity_type: formData.activity_type,
          tags,
          notes: formData.notes.trim() || null
        };
        response = await fetch(`${API_BASE_URL}/candidate-activities`, {
          method: 'POST', headers, credentials: 'include', body: JSON.stringify(candidatePayload)
        });
      } else {
        throw new Error('Unable to determine entity to log activity for.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Call the callback with the new activity
        onActivityAdded(data.activity);
      } else {
        throw new Error(data.message || 'Failed to create activity');
      }
    } catch (err) {
      console.error('Error creating activity:', err);
      setError(err.message || 'Failed to save activity. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-lg mx-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Log Activity for {lead.first_name || lead.name || 'Lead'}
          </h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <i className="fa-solid fa-times text-xl"></i>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <i className="fa-solid fa-exclamation-triangle text-red-500 mr-2"></i>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Activity Type *
            </label>
            <select
              name="activity_type"
              value={formData.activity_type}
              onChange={handleInputChange}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100"
            >
              {activityTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date & Time
            </label>
            <input
              type="datetime-local"
              name="activity_timestamp"
              value={formData.activity_timestamp}
              onChange={handleInputChange}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (optional)
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="e.g., Positive, Needs follow-up, Not a fit"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple tags with commas
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Add details about this interaction..."
              rows={4}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:opacity-50 disabled:bg-gray-100"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  🔘 Save Log
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}