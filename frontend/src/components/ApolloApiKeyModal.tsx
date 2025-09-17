import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

interface ApolloApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentApiKey?: string;
}

export default function ApolloApiKeyModal({ isOpen, onClose, onSuccess, currentApiKey }: ApolloApiKeyModalProps) {
  const [apiKey, setApiKey] = useState(currentApiKey || '');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const handleValidateAndSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Get the session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const backendUrl = import.meta.env.VITE_BACKEND_URL;

      // First validate the key
      const validateResponse = await fetch(`${backendUrl}/api/leads/apollo/validate-key`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ api_key: apiKey })
      });

      const validateData = await validateResponse.json();
      
      if (!validateResponse.ok || !validateData.valid) {
        throw new Error(validateData.error || 'Invalid API key');
      }

      // If validation successful, save the key
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const saveResponse = await fetch(`${backendUrl}/api/leads/apollo/save-key`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          user_id: user.id,
          api_key: apiKey 
        })
      });

      if (!saveResponse.ok) {
        const saveData = await saveResponse.json();
        throw new Error(saveData.error || 'Failed to save API key');
      }

      toast.success('Apollo API key saved successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate and save API key');
    } finally {
      setIsValidating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Apollo API Key</h3>
        <p className="mb-4 text-gray-600 text-sm">
          Enter your Apollo API key below. You can find this in your Apollo settings under API Keys.
        </p>
        <input
          type="password"
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          placeholder="Apollo API Key"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={isValidating}
          >
            Cancel
          </button>
          <button
            onClick={handleValidateAndSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            disabled={isValidating || !apiKey}
          >
            {isValidating ? 'Saving...' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
} 