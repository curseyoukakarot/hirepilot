// Minimal TS interfaces mirroring 20251002_init.sql
export interface LinkedinSession {
  id: string;
  user_id: string;
  status: 'pending' | 'active' | 'hibernated' | 'expired' | 'failed';
  login_method: 'streamed' | 'extension';
  container_id: string | null;
  proxy_id: string | null;
  browser_fingerprint: Record<string, any>;
  cookies_encrypted: string | null;
  localstorage_encrypted: string | null;
  snapshot_key: string | null;
  last_login_at: string | null;
  last_refresh_at: string | null;
  expires_at: string | null;
  failed_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface ProxyPool {
  id: string;
  provider: string;
  label: string | null;
  endpoint: string;
  auth: string | null;
  geo: string | null;
  is_active: boolean;
  created_at: string | null;
}

export interface ContainerInstance {
  id: string;
  session_id: string;
  runtime: 'novnc' | 'webrtc';
  engine: 'docker' | 'k8s' | 'browserless';
  remote_debug_url: string | null;
  stream_url: string | null;
  state: 'starting' | 'ready' | 'hibernating' | 'stopped' | 'error';
  created_at: string | null;
  updated_at: string | null;
}

export interface LinkedinJob {
  id: string;
  user_id: string;
  session_id: string;
  type: string;
  payload: Record<string, any>;
  status: 'queued' | 'running' | 'success' | 'failed';
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
}


