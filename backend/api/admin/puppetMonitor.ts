import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  PuppetAdminDashboardStats,
  PuppetAdminJobDetails,
  PuppetAdminUserPerformance,
  PuppetAdminJobFilters,
  PuppetAdminControls,
  PuppetAdminLog,
  PuppetAdminActionType
} from '../../types/puppet';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Super Admin Puppet Monitor Dashboard (Prompt 7)
 * 
 * Comprehensive monitoring and control system for LinkedIn automation
 * REQUIRES: super_admin role
 */

/**
 * Middleware to verify super admin access
 */
async function verifySuperAdmin(req: Request, res: Response, next: any): Promise<void> {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Check if user has super_admin role
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !user || user.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        error: 'Super admin access required'
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to verify admin access'
    });
  }
}

/**
 * Get comprehensive dashboard statistics
 */
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    console.log('[Admin] Fetching dashboard statistics...');

    const { data: stats, error } = await supabase
      .from('puppet_admin_dashboard_stats')
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to fetch dashboard stats: ${error.message}`);
    }

    const dashboardStats: PuppetAdminDashboardStats = {
      jobs_today: stats.jobs_today || 0,
      jobs_completed_today: stats.jobs_completed_today || 0,
      jobs_failed_today: stats.jobs_failed_today || 0,
      jobs_warned_today: stats.jobs_warned_today || 0,
      jobs_this_week: stats.jobs_this_week || 0,
      connections_this_week: stats.connections_this_week || 0,
      active_jobs: stats.active_jobs || 0,
      users_with_auto_mode: stats.users_with_auto_mode || 0,
      users_paused_by_admin: stats.users_paused_by_admin || 0,
      active_proxies: stats.active_proxies || 0,
      failed_proxies: stats.failed_proxies || 0,
      banned_proxies: stats.banned_proxies || 0,
      captcha_incidents_week: stats.captcha_incidents_week || 0,
      security_incidents_week: stats.security_incidents_week || 0,
      shutdown_mode_active: stats.shutdown_mode_active || false,
      maintenance_mode_active: stats.maintenance_mode_active || false
    };

    res.json({
      success: true,
      data: dashboardStats
    });

  } catch (error) {
    console.error('[Admin] Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats'
    });
  }
}

/**
 * Get paginated job table with filters
 */
export async function getJobTable(req: Request, res: Response): Promise<void> {
  try {
    const filters: PuppetAdminJobFilters = {
      status: req.query.status as any,
      user_email: req.query.user_email as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      proxy_location: req.query.proxy_location as string,
      detection_type: req.query.detection_type as any,
      admin_paused_only: req.query.admin_paused_only === 'true',
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };

    console.log('[Admin] Fetching job table with filters:', filters);

    // Build dynamic query
    let query = supabase
      .from('puppet_admin_job_details')
      .select('*');

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.user_email) {
      query = query.ilike('user_email', `%${filters.user_email}%`);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }
    if (filters.proxy_location) {
      query = query.eq('proxy_location', filters.proxy_location);
    }
    if (filters.detection_type) {
      query = query.eq('detection_type', filters.detection_type);
    }
    if (filters.admin_paused_only) {
      query = query.eq('paused_by_admin', true);
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(filters.offset!, filters.offset! + filters.limit! - 1);

    const { data: jobs, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch job table: ${error.message}`);
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('puppet_admin_job_details')
      .select('id', { count: 'exact' });

    // Apply same filters for count
    if (filters.status) {
      countQuery = countQuery.eq('status', filters.status);
    }
    if (filters.user_email) {
      countQuery = countQuery.ilike('user_email', `%${filters.user_email}%`);
    }
    if (filters.date_from) {
      countQuery = countQuery.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      countQuery = countQuery.lte('created_at', filters.date_to);
    }
    if (filters.proxy_location) {
      countQuery = countQuery.eq('proxy_location', filters.proxy_location);
    }
    if (filters.detection_type) {
      countQuery = countQuery.eq('detection_type', filters.detection_type);
    }
    if (filters.admin_paused_only) {
      countQuery = countQuery.eq('paused_by_admin', true);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.warn('[Admin] Failed to get job count:', countError);
    }

    res.json({
      success: true,
      data: jobs || [],
      pagination: {
        total: count || 0,
        limit: filters.limit,
        offset: filters.offset,
        has_more: (count || 0) > (filters.offset! + filters.limit!)
      },
      filters
    });

  } catch (error) {
    console.error('[Admin] Job table error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job table'
    });
  }
}

/**
 * Get detailed job information with logs
 */
export async function getJobDetails(req: Request, res: Response): Promise<void> {
  try {
    const jobId = req.params.jobId;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
      return;
    }

    console.log(`[Admin] Fetching job details for: ${jobId}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('puppet_admin_job_details')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      throw new Error(`Failed to fetch job details: ${jobError.message}`);
    }

    if (!job) {
      res.status(404).json({
        success: false,
        error: 'Job not found'
      });
      return;
    }

    // Get job logs
    const { data: logs, error: logsError } = await supabase
      .from('puppet_job_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('timestamp', { ascending: true });

    if (logsError) {
      console.warn(`[Admin] Failed to fetch logs for job ${jobId}:`, logsError);
    }

    // Get admin action history for this job
    const { data: adminActions, error: actionsError } = await supabase
      .from('puppet_admin_log')
      .select('*')
      .eq('target_job_id', jobId)
      .order('created_at', { ascending: false });

    if (actionsError) {
      console.warn(`[Admin] Failed to fetch admin actions for job ${jobId}:`, actionsError);
    }

    res.json({
      success: true,
      data: {
        job,
        logs: logs || [],
        admin_actions: adminActions || []
      }
    });

  } catch (error) {
    console.error('[Admin] Job details error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job details'
    });
  }
}

/**
 * Get user performance metrics
 */
export async function getUserPerformance(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = req.query.sort_by as string || 'connections_today';
    const sortOrder = req.query.sort_order as string || 'desc';

    console.log('[Admin] Fetching user performance metrics...');

    const { data: users, error } = await supabase
      .from('puppet_admin_user_performance')
      .select('*')
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch user performance: ${error.message}`);
    }

    res.json({
      success: true,
      data: users || [],
      pagination: {
        limit,
        offset,
        total: users?.length || 0
      }
    });

  } catch (error) {
    console.error('[Admin] User performance error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user performance'
    });
  }
}

/**
 * Get system status and admin controls
 */
export async function getSystemStatus(req: Request, res: Response): Promise<void> {
  try {
    console.log('[Admin] Fetching system status...');

    const { data: systemStatus, error } = await supabase
      .rpc('get_puppet_system_status');

    if (error) {
      throw new Error(`Failed to fetch system status: ${error.message}`);
    }

    res.json({
      success: true,
      data: systemStatus || {}
    });

  } catch (error) {
    console.error('[Admin] System status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch system status'
    });
  }
}

/**
 * Get admin activity log
 */
export async function getAdminLog(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const actionType = req.query.action_type as string;

    console.log('[Admin] Fetching admin activity log...');

    let query = supabase
      .from('puppet_admin_log')
      .select(`
        *,
        admin_user:admin_user_id(email),
        target_user:target_user_id(email)
      `);

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: logs, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch admin log: ${error.message}`);
    }

    res.json({
      success: true,
      data: logs || [],
      pagination: {
        limit,
        offset,
        total: logs?.length || 0
      }
    });

  } catch (error) {
    console.error('[Admin] Admin log error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch admin log'
    });
  }
}

/**
 * Get proxy pool status
 */
export async function getProxyStatus(req: Request, res: Response): Promise<void> {
  try {
    console.log('[Admin] Fetching proxy pool status...');

    const { data: proxies, error } = await supabase
      .from('puppet_proxies')
      .select('*')
      .order('status', { ascending: true })
      .order('success_count', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch proxy status: ${error.message}`);
    }

    // Calculate summary stats
    const summary = {
      total: proxies?.length || 0,
      active: proxies?.filter(p => p.status === 'active').length || 0,
      failed: proxies?.filter(p => p.status === 'failed').length || 0,
      banned: proxies?.filter(p => p.status === 'banned').length || 0,
      rate_limited: proxies?.filter(p => p.status === 'rate_limited').length || 0,
      total_requests_today: proxies?.reduce((sum, p) => sum + (p.requests_today || 0), 0) || 0
    };

    res.json({
      success: true,
      data: {
        proxies: proxies || [],
        summary
      }
    });

  } catch (error) {
    console.error('[Admin] Proxy status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch proxy status'
    });
  }
}

/**
 * Helper function to log admin actions
 */
export async function logAdminAction(
  adminUserId: string,
  actionType: PuppetAdminActionType,
  description: string,
  targetJobId?: string,
  targetUserId?: string,
  targetProxyId?: string,
  metadata?: Record<string, any>,
  successful: boolean = true,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('puppet_admin_log')
      .insert({
        admin_user_id: adminUserId,
        action_type: actionType,
        action_description: description,
        target_job_id: targetJobId,
        target_user_id: targetUserId,
        target_proxy_id: targetProxyId,
        action_successful: successful,
        error_message: errorMessage,
        metadata: metadata || {}
      });
  } catch (error) {
    console.error('[Admin] Failed to log admin action:', error);
  }
}

// Apply super admin middleware to all routes
export const adminMiddleware = verifySuperAdmin;

export default {
  getDashboardStats,
  getJobTable,
  getJobDetails,
  getUserPerformance,
  getSystemStatus,
  getAdminLog,
  getProxyStatus,
  logAdminAction,
  adminMiddleware
}; 