import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalSession, setOriginalSession] = useState(null);

  useEffect(() => {
    // Check if we're currently impersonating
    const storedSession = localStorage.getItem('superAdminSession');
    if (storedSession) {
      setIsImpersonating(true);
      setOriginalSession(JSON.parse(storedSession));
    }
  }, []);

  const exitImpersonation = async () => {
    try {
      const storedSession = localStorage.getItem('superAdminSession');
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        
        // Restore the original super admin session
        const { error } = await supabase.auth.setSession({
          access_token: parsed.data.session.access_token,
          refresh_token: parsed.data.session.refresh_token
        });

        if (error) {
          console.error('Error restoring session:', error);
          toast.error('Failed to restore original session');
          return;
        }

        // Clear the stored session
        localStorage.removeItem('superAdminSession');
        setIsImpersonating(false);
        setOriginalSession(null);
        
        // Reload the page to refresh the UI
        window.location.reload();
      }
    } catch (error) {
      console.error('Error exiting impersonation:', error);
      toast.error('Failed to exit impersonation');
    }
  };

  if (!isImpersonating) return null;

  return (
    <div className="bg-red-600 text-white p-3 text-center fixed top-0 w-full z-50 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">You are impersonating another user</span>
        </div>
        <button
          onClick={exitImpersonation}
          className="px-4 py-2 bg-white text-red-600 rounded-md font-medium hover:bg-gray-100 transition-colors"
        >
          Exit Impersonation
        </button>
      </div>
    </div>
  );
}
