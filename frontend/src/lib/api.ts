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

// Ensure base URL has no trailing slash and provide sane runtime fallbacks
function resolveApiBase() {
  let base = (import.meta.env.VITE_BACKEND_URL || '').trim();
  if (!base) {
    try {
      const host = window.location.host;
      if (host.endsWith('thehirepilot.com')) base = 'https://api.thehirepilot.com';
      else base = 'http://localhost:8080';
    } catch {
      base = '';
    }
  }
  return base.replace(/\/$/, '');
}
const API_BASE_URL = resolveApiBase();

interface ApiOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function api(endpoint: string, options: ApiOptions = {}) {
  const { requireAuth = true, ...fetchOptions } = options;
  
  // Get user and access token if auth is required
  let userId: string | undefined;
  let accessToken: string | undefined;
  if (requireAuth) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user || !session?.access_token) {
      throw new Error('Missing or invalid bearer token');
    }
    userId = user.id;
    accessToken = session.access_token;
  }

  // Prepare headers
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (userId) headers.set('x-user-id', userId);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

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