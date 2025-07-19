// Puppet LinkedIn Automation System Types
// Production-grade TypeScript interfaces for the Puppet system

export type PuppetJobStatus = 
  | 'pending'
  | 'queued' 
  | 'running'
  | 'completed'
  | 'failed'
  | 'warning'
  | 'cancelled'
  | 'rate_limited';

export type PuppetDetectionType = 
  | 'captcha'
  | 'phone_verification'
  | 'security_checkpoint'
  | 'account_restriction'
  | 'suspicious_activity'
  | 'login_challenge';

export type PuppetProxyStatus = 
  | 'active'
  | 'inactive'
  | 'failed'
  | 'rate_limited'
  | 'banned';

export type PuppetLogLevel = 'info' | 'warn' | 'error' | 'debug';

export type PuppetNotificationEvent = 
  | 'warning'
  | 'daily_limit_reached'
  | 'job_failed'
  | 'job_completed'
  | 'captcha_detected'
  | 'security_checkpoint';

// Core Database Models
export interface PuppetJob {
  id: string;
  user_id: string;
  campaign_id?: string;
  
  // Job Details
  linkedin_profile_url: string;
  message?: string;
  priority: number;
  
  // Status & Timing
  status: PuppetJobStatus;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  
  // Results & Metadata
  result_data: Record<string, any>;
  error_message?: string;
  detection_type?: PuppetDetectionType;
  screenshot_url?: string;
  
  // Safety & Rate Limiting
  retry_count: number;
  max_retries: number;
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface PuppetUserSettings {
  id: string;
  user_id: string;
  
  // LinkedIn Cookie (encrypted)
  li_at_cookie?: string;
  
  // Automation Settings
  auto_mode_enabled: boolean; // Legacy field (for backward compatibility)
  rex_auto_mode_enabled: boolean; // REX Auto Mode toggle
  daily_connection_limit: number;
  min_delay_seconds: number;
  max_delay_seconds: number;
  
  // REX Consent & Tracking
  automation_consent: boolean;
  automation_consent_date?: string;
  last_manual_review_at?: string;
  
  // Proxy Assignment
  proxy_id?: string;
  
  // Safety Settings
  captcha_detection_enabled: boolean;
  auto_pause_on_warning: boolean;
  
  // Notifications
  slack_webhook_url?: string;
  notification_events: PuppetNotificationEvent[];
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface PuppetProxy {
  id: string;
  
  // Proxy Details
  proxy_provider: string;
  proxy_endpoint: string;
  proxy_port: number;
  proxy_username: string;
  proxy_password: string;
  proxy_location?: string;
  
  // Status & Health
  status: PuppetProxyStatus;
  last_health_check?: string;
  failure_count: number;
  success_count: number;
  
  // Rate Limiting
  requests_today: number;
  daily_limit: number;
  last_reset_date: string;
  
  // Assignment
  assigned_user_id?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface PuppetJobLog {
  id: string;
  job_id: string;
  
  // Log Details
  log_level: PuppetLogLevel;
  message: string;
  step_name?: string;
  
  // Technical Details
  screenshot_url?: string;
  page_url?: string;
  user_agent?: string;
  proxy_used?: string;
  
  // Timing
  execution_time_ms?: number;
  timestamp: string;
}

export interface PuppetDailyStats {
  id: string;
  user_id: string;
  
  // Date
  stat_date: string;
  
  // Counters
  connections_sent: number;
  messages_sent: number;
  jobs_completed: number;
  jobs_failed: number;
  jobs_warned: number;
  
  // Safety Events
  captcha_detections: number;
  security_warnings: number;
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface PuppetScreenshot {
  id: string;
  job_id?: string;
  
  // Screenshot Details
  detection_type?: PuppetDetectionType;
  file_url: string;
  file_size?: number;
  
  // Context
  page_url?: string;
  user_agent?: string;
  timestamp: string;
}

// REX Integration Types (Prompt 6)
export type RexActivityType = 
  | 'manual_review'
  | 'auto_queue'
  | 'consent_granted'
  | 'consent_revoked'
  | 'auto_mode_enabled'
  | 'auto_mode_disabled'
  | 'manual_override';

export interface RexActivityLog {
  id: string;
  user_id: string;
  lead_id?: string;
  campaign_id?: string;
  
  // Activity Details
  activity_type: RexActivityType;
  activity_description: string;
  
  // LinkedIn Details
  linkedin_profile_url?: string;
  message_content?: string;
  
  // Job Reference
  puppet_job_id?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Audit
  created_at: string;
}

export interface RexLinkedInRequestData {
  lead_id?: string;
  campaign_id?: string;
  linkedin_profile_url: string;
  profile_name?: string;
  profile_headline?: string;
  drafted_message: string;
  priority?: number;
}

export interface RexModalResponse {
  success: boolean;
  mode: 'manual' | 'auto';
  action: 'review_required' | 'queued_immediately' | 'consent_required';
  data: {
    drafted_message?: string;
    job_id?: string;
    activity_log_id?: string;
    daily_limit_remaining?: number;
    consent_required?: boolean;
    error_message?: string;
  };
}

export interface RexConsentRequest {
  user_id: string;
  consent_granted: boolean;
  consent_text: string;
}

export interface RexAutoModeToggleRequest {
  user_id: string;
  auto_mode_enabled: boolean;
}

// Super Admin Dashboard Types (Prompt 7)
export type PuppetAdminActionType =
  | 'job_retry'
  | 'job_kill'
  | 'user_pause'
  | 'user_unpause'
  | 'emergency_shutdown'
  | 'shutdown_disable'
  | 'maintenance_enable'
  | 'maintenance_disable'
  | 'proxy_manage'
  | 'bulk_action';

export interface PuppetAdminControls {
  id: string;
  
  // Emergency Controls
  puppet_shutdown_mode: boolean;
  shutdown_reason?: string;
  shutdown_initiated_by?: string;
  shutdown_initiated_at?: string;
  
  // System Settings
  max_concurrent_jobs: number;
  global_rate_limit_per_hour: number;
  emergency_contact_email?: string;
  
  // Maintenance Mode
  maintenance_mode: boolean;
  maintenance_message?: string;
  maintenance_scheduled_until?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface PuppetAdminLog {
  id: string;
  admin_user_id: string;
  
  // Action Details
  action_type: PuppetAdminActionType;
  action_description: string;
  
  // Target Details
  target_job_id?: string;
  target_user_id?: string;
  target_proxy_id?: string;
  
  // Action Results
  action_successful: boolean;
  error_message?: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Audit
  created_at: string;
}

export interface PuppetAdminDashboardStats {
  // Today's Stats
  jobs_today: number;
  jobs_completed_today: number;
  jobs_failed_today: number;
  jobs_warned_today: number;
  
  // This Week's Stats
  jobs_this_week: number;
  connections_this_week: number;
  
  // Active Users & Jobs
  active_jobs: number;
  users_with_auto_mode: number;
  users_paused_by_admin: number;
  
  // Proxy Stats
  active_proxies: number;
  failed_proxies: number;
  banned_proxies: number;
  
  // Error Trends
  captcha_incidents_week: number;
  security_incidents_week: number;
  
  // System Status
  shutdown_mode_active: boolean;
  maintenance_mode_active: boolean;
}

export interface PuppetAdminJobDetails {
  id: string;
  user_id: string;
  user_email: string;
  linkedin_profile_url: string;
  message?: string;
  status: PuppetJobStatus;
  priority: number;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  admin_retry_count: number;
  max_retries: number;
  error_message?: string;
  detection_type?: PuppetDetectionType;
  admin_notes?: string;
  paused_by_admin: boolean;
  created_at: string;
  updated_at: string;
  
  // User Settings
  rex_auto_mode_enabled: boolean;
  daily_connection_limit: number;
  user_admin_paused: boolean;
  admin_paused_reason?: string;
  
  // Proxy Info
  proxy_provider?: string;
  proxy_endpoint?: string;
  proxy_location?: string;
  proxy_status?: PuppetProxyStatus;
  
  // Daily Stats
  user_connections_today: number;
  user_captcha_today: number;
  
  // Execution Time
  execution_time_seconds?: number;
}

export interface PuppetAdminUserPerformance {
  user_id: string;
  email: string;
  rex_auto_mode_enabled: boolean;
  daily_connection_limit: number;
  admin_paused: boolean;
  admin_paused_reason?: string;
  automation_consent: boolean;
  
  // Today's Performance
  connections_today: number;
  jobs_completed_today: number;
  jobs_failed_today: number;
  captcha_today: number;
  
  // This Week's Performance
  connections_this_week: number;
  jobs_this_week: number;
  
  // Current Active Jobs
  active_jobs_count: number;
  pending_jobs_count: number;
  
  // Proxy Assignment
  proxy_provider?: string;
  proxy_location?: string;
  proxy_status?: PuppetProxyStatus;
  
  // Last Activity
  last_manual_review_at?: string;
  last_job_created?: string;
}

export interface PuppetAdminJobFilters {
  status?: PuppetJobStatus;
  user_email?: string;
  date_from?: string;
  date_to?: string;
  proxy_location?: string;
  detection_type?: PuppetDetectionType;
  admin_paused_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface PuppetAdminJobAction {
  job_id: string;
  action: 'retry' | 'kill' | 'pause' | 'add_notes';
  reason?: string;
  admin_notes?: string;
}

export interface PuppetAdminUserAction {
  user_id: string;
  action: 'pause' | 'unpause' | 'reset_limits' | 'assign_proxy';
  reason?: string;
  proxy_id?: string;
}

export interface PuppetAdminBulkAction {
  action: 'pause_users' | 'kill_jobs' | 'retry_failed' | 'clear_warnings';
  target_ids: string[];
  reason?: string;
}

export interface PuppetAdminEmergencyAction {
  action: 'emergency_shutdown' | 'disable_shutdown' | 'maintenance_mode';
  reason?: string;
  maintenance_message?: string;
  scheduled_until?: string;
}

// Service Layer Types
export interface PuppetJobRequest {
  user_id: string;
  linkedin_profile_url: string;
  message?: string;
  campaign_id?: string;
  priority?: number;
  scheduled_at?: Date;
}

export interface PuppetJobResult {
  success: boolean;
  connection_sent: boolean;
  message_sent: boolean;
  detection_type?: PuppetDetectionType;
  error_message?: string;
  screenshot_url?: string;
  execution_time_ms: number;
  page_url?: string;
}

export interface PuppetProxyConfig {
  proxy_endpoint: string;
  proxy_port: number;
  proxy_username: string;
  proxy_password: string;
  proxy_location?: string;
}

export interface PuppetExecutionConfig {
  user_id: string;
  job_id: string;
  linkedin_profile_url: string;
  message?: string;
  li_at_cookie: string;
  proxy_config?: PuppetProxyConfig;
  user_settings: {
    min_delay_seconds: number;
    max_delay_seconds: number;
    captcha_detection_enabled: boolean;
    auto_pause_on_warning: boolean;
  };
}

export interface PuppetSecurityDetection {
  type: PuppetDetectionType;
  confidence: number; // 0-1
  screenshot_url?: string;
  page_url: string;
  detected_elements: string[];
  timestamp: Date;
}

export interface PuppetSlackNotification {
  event_type: PuppetNotificationEvent;
  user_id: string;
  job_id: string;
  message: string;
  detection_type?: PuppetDetectionType;
  screenshot_url?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Browser Automation Types
export interface PuppetBrowserConfig {
  headless: boolean;
  user_agent: string;
  viewport: {
    width: number;
    height: number;
  };
  proxy_config?: PuppetProxyConfig;
  timeout_ms: number;
}

export interface PuppetLinkedInElements {
  connect_button: string;
  message_button: string;
  send_button: string;
  note_textarea: string;
  
  // Security Detection Selectors
  captcha_container: string[];
  phone_verification: string[];
  security_checkpoint: string[];
  account_restriction: string[];
  suspicious_activity: string[];
  login_challenge: string[];
}

export interface PuppetHumanBehavior {
  scroll_delay_ms: [number, number]; // Random range
  click_delay_ms: [number, number];
  type_delay_ms: [number, number];
  mouse_movement_enabled: boolean;
  random_pauses: boolean;
}

// API Response Types
export interface PuppetApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
  detection?: PuppetSecurityDetection;
}

export interface PuppetJobQueueResponse {
  job_id: string;
  status: PuppetJobStatus;
  estimated_execution_time?: number;
  queue_position?: number;
}

export interface PuppetUserStatsResponse {
  today: {
    connections_sent: number;
    messages_sent: number;
    jobs_completed: number;
    jobs_failed: number;
    daily_limit_remaining: number;
  };
  this_week: {
    connections_sent: number;
    success_rate: number;
  };
  warnings: {
    recent_captcha_detections: number;
    security_warnings: number;
  };
}

// Admin UI Types
export interface PuppetAdminJobView extends PuppetJob {
  user_email?: string;
  proxy_location?: string;
  logs_count: number;
  last_log_message?: string;
}

export interface PuppetAdminStatsView {
  total_jobs_today: number;
  successful_connections: number;
  failed_jobs: number;
  warning_jobs: number;
  active_proxies: number;
  users_with_auto_mode: number;
  captcha_detections_today: number;
  top_error_messages: Array<{
    message: string;
    count: number;
  }>;
}

// Error Types
export class PuppetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly job_id?: string,
    public readonly detection_type?: PuppetDetectionType,
    public readonly screenshot_url?: string
  ) {
    super(message);
    this.name = 'PuppetError';
  }
}

export class PuppetSecurityError extends PuppetError {
  constructor(
    detection_type: PuppetDetectionType,
    job_id: string,
    screenshot_url?: string
  ) {
    super(
      `Security detection: ${detection_type}`,
      'SECURITY_DETECTION',
      job_id,
      detection_type,
      screenshot_url
    );
    this.name = 'PuppetSecurityError';
  }
}

export class PuppetRateLimitError extends PuppetError {
  constructor(
    message: string,
    job_id: string,
    public readonly daily_limit: number,
    public readonly current_count: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', job_id);
    this.name = 'PuppetRateLimitError';
  }
}

// Configuration Constants
export const PUPPET_CONSTANTS = {
  MAX_DAILY_CONNECTIONS: 50,
  MIN_DAILY_CONNECTIONS: 1,
  DEFAULT_DAILY_LIMIT: 20,
  
  MIN_DELAY_SECONDS: 30,
  MAX_DELAY_SECONDS: 300,
  DEFAULT_MIN_DELAY: 60,
  DEFAULT_MAX_DELAY: 180,
  
  MAX_MESSAGE_LENGTH: 300,
  MAX_RETRIES: 2,
  
  BROWSER_TIMEOUT_MS: 60000,
  PAGE_LOAD_TIMEOUT_MS: 30000,
  ELEMENT_WAIT_TIMEOUT_MS: 10000,
  
  SCREENSHOT_MAX_SIZE_MB: 5,
  LOG_RETENTION_DAYS: 30,
  
  PROXY_HEALTH_CHECK_INTERVAL_HOURS: 6,
  DAILY_STATS_RESET_HOUR: 0, // UTC midnight
} as const; 