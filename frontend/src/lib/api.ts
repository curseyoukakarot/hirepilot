// Add type declaration for import.meta.env
declare global {
  interface ImportMeta {
    env: {
      VITE_SUPABASE_URL: string;
      VITE_SUPABASE_ANON_KEY: string;
      VITE_BACKEND_URL: string;
    };
  }
}

import { supabase } from './supabase';

// Ensure base URL has no trailing slash
const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

interface ApiOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function api(endpoint: string, options: ApiOptions = {}) {
  const { requireAuth = true, ...fetchOptions } = options;
  
  // Get user ID if auth is required
  let userId: string | undefined;
  if (requireAuth) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    userId = user.id;
  }

  // Prepare headers
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (userId) {
    headers.set('x-user-id', userId);
  }

  // Make the request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include'
  });

  // Handle response
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.error || error.message || `${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Convenience methods
export const apiGet = (endpoint: string, options?: ApiOptions) => 
  api(endpoint, { ...options, method: 'GET' });

export const apiPost = (endpoint: string, data?: any, options?: ApiOptions) =>
  api(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) });

export const apiPut = (endpoint: string, data?: any, options?: ApiOptions) =>
  api(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) });

export const apiDelete = (endpoint: string, options?: ApiOptions) =>
  api(endpoint, { ...options, method: 'DELETE' }); 