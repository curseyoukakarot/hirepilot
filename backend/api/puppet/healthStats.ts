/**
 * Puppet Health Statistics API
 * Provides comprehensive monitoring data for the admin dashboard
 */

import { createClient } from '@supabase/supabase-js';
import express from 'express';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = express.Router();

// 🔧 ERROR HANDLING WRAPPER - Prevents HTML error pages
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Puppet API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      endpoint: req.path
    });
  });
};

// 🔧 DEBUG: Simple test endpoint
router.get('/test', asyncHandler(async (req: any, res: any) => {
  res.json({ 
    status: 'ok', 
    message: 'Puppet health API is working',
    timestamp: new Date().toISOString()
  });
}));

// ===============================================
// 1. Job Queue Statistics
// ===============================================
router.get('/stats/jobs', asyncHandler(async (req: any, res: any) => {
  try {
    console.log('📊 Puppet health - fetching job stats');
    
    const timeRange = req.query.hours ? parseInt(req.query.hours as string) : 24;
    const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();

    // Get job counts by status
    const { data: jobStats, error: jobError } = await supabase
      .from('puppet_jobs')
      .select('status, final_status, created_at')
      .gte('created_at', cutoffTime);

    if (jobError) {
      console.error('Job stats error:', jobError);
      return res.status(500).json({ 
        error: 'Failed to fetch job statistics',
        details: jobError.message 
      });
    }

    // Get retry backlog
    const { data: retryJobs, error: retryError } = await supabase
      .from('puppet_jobs')
      .select('id, next_retry_at, retry_count')
      .eq('final_status', 'failed')
      .not('next_retry_at', 'is', null)
      .gte('next_retry_at', new Date().toISOString());

    if (retryError) {
      console.error('Retry stats error:', retryError);
      return res.status(500).json({ 
        error: 'Failed to fetch retry statistics',
        details: retryError.message 
      });
    }

    // Calculate stats safely
    const safeJobStats = jobStats || [];
    const safeRetryJobs = retryJobs || [];
    
    const stats = {
      pending: safeJobStats.filter(j => j.status === 'queued').length,
      in_progress: safeJobStats.filter(j => j.status === 'running').length,
      completed: safeJobStats.filter(j => j.final_status === 'completed').length,
      failed: safeJobStats.filter(j => j.final_status === 'failed' || j.final_status === 'permanently_failed').length,
      total: safeJobStats.length,
      retry_backlog: safeRetryJobs?.length || 0,
      retry_jobs_ready: safeRetryJobs?.filter(j => new Date(j.next_retry_at) <= new Date()).length || 0
    };

    // Job trend data (hourly breakdown)
    const hourlyTrend = Array.from({ length: 24 }, (_, i) => {
      const hourStart = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
      const hourEnd = new Date(Date.now() - (22 - i) * 60 * 60 * 1000);
      
      const hourJobs = safeJobStats.filter(job => {
        const jobTime = new Date(job.created_at);
        return jobTime >= hourStart && jobTime < hourEnd;
      });

      return {
        hour: hourStart.getHours(),
        total: hourJobs.length,
        completed: hourJobs.filter(j => j.final_status === 'completed').length,
        failed: hourJobs.filter(j => j.final_status === 'failed' || j.final_status === 'permanently_failed').length
      };
    });

    res.json({
      success: true,
      data: {
        ...stats,
        success_rate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0',
        hourly_trend: hourlyTrend,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Job stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch job statistics' 
    });
  }
}));

// ===============================================
// 2. Proxy Health Statistics
// ===============================================
router.get('/stats/proxies', asyncHandler(async (req: any, res: any) => {
  try {
    const timeRange = 24; // Last 24 hours
    const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();

    // Get proxy assignments and their performance (no joins)
    const { data: proxyData, error: proxyError } = await supabase
      .from('proxy_assignments')
      .select('*')
      .gte('assigned_at', cutoffTime);

    if (proxyError) {
      throw new Error(`Proxy stats error: ${proxyError.message}`);
    }

    const proxyStats = new Map();

    proxyData?.forEach((assignment: any) => {
      const proxyId = assignment.proxy_id;
      const userId = assignment.user_id;
      const wasSuccessful = assignment.was_successful;

      if (!proxyStats.has(proxyId)) {
        proxyStats.set(proxyId, {
          proxy_id: proxyId,
          assigned_user_id: userId,
          success_count: 0,
          failure_count: 0,
          total_jobs: 0,
          current_status: assignment.status || 'active',
          last_used: assignment.assigned_at,
          rotation_count: 0
        });
      }

      const stats = proxyStats.get(proxyId);
      stats.total_jobs += 1;

      if (wasSuccessful === true) {
        stats.success_count += 1;
      } else if (wasSuccessful === false) {
        stats.failure_count += 1;
      }

      if (assignment.assigned_at && new Date(assignment.assigned_at) > new Date(stats.last_used)) {
        stats.last_used = assignment.assigned_at;
        stats.assigned_user_id = userId;
      }
    });

    // Convert to array and add health status
    const proxies = Array.from(proxyStats.values()).map(proxy => ({
      ...proxy,
      success_rate: proxy.total_jobs > 0 ? ((proxy.success_count / proxy.total_jobs) * 100).toFixed(1) : '0',
      health_status: proxy.total_jobs === 0 ? 'inactive' : 
                    (proxy.success_count / proxy.total_jobs) > 0.8 ? 'healthy' : 
                    (proxy.success_count / proxy.total_jobs) > 0.5 ? 'warning' : 'unhealthy'
    }));

    res.json({
      success: true,
      data: {
        proxies: proxies.sort((a, b) => b.total_jobs - a.total_jobs),
        summary: {
          total_proxies: proxies.length,
          healthy_proxies: proxies.filter((p: any) => p.health_status === 'healthy').length,
          warning_proxies: proxies.filter((p: any) => p.health_status === 'warning').length,
          unhealthy_proxies: proxies.filter((p: any) => p.health_status === 'unhealthy').length,
          inactive_proxies: proxies.filter((p: any) => p.health_status === 'inactive').length
        },
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Proxy stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch proxy statistics' 
    });
  }
}));

// ===============================================
// 3. Warm-Up Tier Tracking
// ===============================================
router.get('/stats/warmup-tiers', asyncHandler(async (req: any, res: any) => {
  try {
    const daysBack = 3; // Last 3 days for success rate calculation
    const cutoffTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    // Get user warm-up status from view (no joins required)
    const { data: warmupData, error: warmupError } = await supabase
      .from('linkedin_user_warmup_status')
      .select('*');

    if (warmupError) {
      throw new Error(`Warmup stats error: ${warmupError.message}`);
    }

    const warmupUsers = (warmupData || []).map((u: any) => {
      const consecutiveDays = u.consecutive_successful_days || 0;
      const daysInTier = u.last_tier_upgrade_date ?
        Math.floor((Date.now() - new Date(u.last_tier_upgrade_date).getTime()) / (24 * 60 * 60 * 1000)) : 0;

      const successRate = u.today_invites_sent > 0 ?
        (((u.today_invites_sent - u.failed_invites_today) / u.today_invites_sent) * 100).toFixed(1) : '0';

      return {
        user_email: u.email,
        current_tier: u.current_tier,
        daily_limit: u.current_daily_limit,
        today_invites_sent: u.today_invites_sent,
        remaining_invites_today: u.remaining_invites_today,
        success_rate: successRate,
        days_in_tier: daysInTier,
        auto_advance_eligible: u.auto_advance_enabled && consecutiveDays >= 7 && Number(successRate) > 80
      };
    });

    res.json({
      success: true,
      data: {
        users: warmupUsers.sort((a, b) => b.current_tier - a.current_tier || b.today_invites_sent - a.today_invites_sent),
        summary: {
          total_users: warmupUsers.length,
          users_by_tier: {
            tier_1: warmupUsers.filter(u => u.current_tier === 1).length,
            tier_2: warmupUsers.filter(u => u.current_tier === 2).length,
            tier_3: warmupUsers.filter(u => u.current_tier === 3).length,
            tier_4_plus: warmupUsers.filter(u => u.current_tier >= 4).length
          },
          auto_advance_ready: warmupUsers.filter(u => u.auto_advance_eligible).length
        },
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Warmup tier stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch warmup tier statistics' 
    });
  }
}));

// ===============================================
// 4. Deduplication Warnings
// ===============================================
router.get('/stats/deduped-invites', asyncHandler(async (req: any, res: any) => {
  try {
    const timeRange = parseInt(req.query.hours as string) || 24;
    const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();

    // Get recent deduplication blocks
    const { data: dedupData, error: dedupError } = await supabase
      .from('puppet_invite_deduplication_log')
      .select('*')
      .gte('blocked_at', cutoffTime)
      .order('blocked_at', { ascending: false })
      .limit(100);

    if (dedupError) {
      if (dedupError.message?.includes('does not exist')) {
        // Table not present in this environment – return empty dataset
        return res.json({
          success: true,
          data: {
            warnings: [],
            summary: {
              total_blocked: 0,
              active_cooldowns: 0,
              rule_breakdown: {},
              top_profiles: {}
            },
            last_updated: new Date().toISOString()
          }
        });
      }
      throw new Error(`Deduplication stats error: ${dedupError.message}`);
    }

    // Process deduplication data
    const dedupWarnings = dedupData?.map(entry => ({
      id: entry.id,
      user_id: entry.user_id,
      profile_url: entry.linkedin_profile_url,
      rule_triggered: entry.deduplication_rule || entry.reason || 'Unknown',
      blocked_reason: entry.blocked_reason || entry.reason || 'Duplicate invite detected',
      blocked_at: entry.blocked_at,
      cooldown_end: entry.cooldown_end_at,
      cooldown_active: entry.cooldown_end_at ? new Date(entry.cooldown_end_at) > new Date() : false,
      days_until_retry: entry.cooldown_end_at ? 
        Math.ceil((new Date(entry.cooldown_end_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 0
    })) || [];

    // Group by rule for summary
    const ruleBreakdown = dedupWarnings.reduce((acc, warning) => {
      const rule = warning.rule_triggered;
      acc[rule] = (acc[rule] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        warnings: dedupWarnings,
        summary: {
          total_blocked: dedupWarnings.length,
          active_cooldowns: dedupWarnings.filter(w => w.cooldown_active).length,
          rule_breakdown: ruleBreakdown,
          top_profiles: dedupWarnings
            .reduce((acc, w) => {
              acc[w.profile_url] = (acc[w.profile_url] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
        },
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Deduplication stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch deduplication statistics' 
    });
  }
}));

// ===============================================
// 5. System Health Summary
// ===============================================
router.get('/stats/summary', asyncHandler(async (req: any, res: any) => {
  try {
    const timeRange = 24; // Last 24 hours
    const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();

    // Get comprehensive system stats including CAPTCHA data
    const [jobsResult, proxiesResult, retryResult, dedupResult, captchaResult] = await Promise.all([
      // Job success rate
      supabase
        .from('puppet_jobs')
        .select('final_status')
        .gte('created_at', cutoffTime),
      
      // Proxy health
      supabase
        .from('proxy_assignments')
        .select('status')
        .gte('assigned_at', cutoffTime),
      
      // Retry rate
      supabase
        .from('puppet_job_retry_history')
        .select('success')
        .gte('attempted_at', cutoffTime),
      
      // Deduplication blocks
      supabase
        .from('puppet_invite_deduplication_log')
        .select('id')
        .gte('blocked_at', cutoffTime),

      // 🆕 CAPTCHA incidents
      supabase
        .from('puppet_captcha_incidents')
        .select('id, captcha_type, incident_status, detected_at')
        .gte('detected_at', cutoffTime)
    ]);

    // Gracefully handle environments where some tables/views are not present yet
    const safeData = (result: any) => {
      if (!result) return [];
      if (!result.error) return result.data || [];
      if (result.error?.message?.includes('does not exist')) return [];
      // For other errors propagate
      throw result.error;
    };

    const jobs = safeData(jobsResult);
    const proxies = safeData(proxiesResult);
    const retries = safeData(retryResult);
    const dedupBlocks = safeData(dedupResult);
    const captchaIncidents = safeData(captchaResult);

    // If we reach here, no critical errors occurred

    // Calculate key metrics
    const totalJobs = jobs.length;
    const successfulJobs = jobs.filter(j => j.final_status === 'completed').length;
    const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 100;

    const totalRetries = retries.length;
    const successfulRetries = retries.filter(r => r.success).length;
    const retrySuccessRate = totalRetries > 0 ? (successfulRetries / totalRetries) * 100 : 100;

    const uniqueProxies = new Set(proxies.map((p: any) => p.proxy_url || p.id || p.proxy_id || 'unknown')).size;
    const failedProxies = proxies.filter(p => p.status === 'failed' || p.status === 'rotated').length;

    // 🆕 CAPTCHA metrics
    const totalCaptchaIncidents = captchaIncidents.length;
    const unresolvedCaptcha = captchaIncidents.filter(c => 
      ['detected', 'acknowledged', 'investigating'].includes(c.incident_status)
    ).length;
    const recentCaptchaRate = totalJobs > 0 ? (totalCaptchaIncidents / totalJobs) * 100 : 0;

    // Determine system health status (including CAPTCHA factor)
    const isHealthy = successRate >= 80 && retrySuccessRate >= 60 && failedProxies < uniqueProxies * 0.3 && totalCaptchaIncidents < 5;
    const isWarning = successRate >= 60 && retrySuccessRate >= 40 && failedProxies < uniqueProxies * 0.5 && totalCaptchaIncidents < 10;

    const systemStatus = isHealthy ? 'healthy' : isWarning ? 'warning' : 'critical';

    // Generate alerts (including CAPTCHA alerts)
    const alerts = [];
    if (successRate < 60) {
      alerts.push({
        type: 'error',
        message: `Low job success rate: ${successRate.toFixed(1)}%`,
        metric: 'job_success_rate',
        value: successRate
      });
    }
    if (failedProxies > uniqueProxies * 0.3) {
      alerts.push({
        type: 'warning',
        message: `High proxy failure rate: ${failedProxies}/${uniqueProxies} proxies failed`,
        metric: 'proxy_failures',
        value: failedProxies
      });
    }
    if (totalRetries > totalJobs * 0.5) {
      alerts.push({
        type: 'warning',
        message: `High retry rate: ${((totalRetries / totalJobs) * 100).toFixed(1)}%`,
        metric: 'retry_rate',
        value: (totalRetries / totalJobs) * 100
      });
    }
    if (dedupBlocks.length > 50) {
      alerts.push({
        type: 'info',
        message: `High deduplication activity: ${dedupBlocks.length} blocks`,
        metric: 'dedup_blocks',
        value: dedupBlocks.length
      });
    }
    
    // 🆕 CAPTCHA-specific alerts
    if (totalCaptchaIncidents > 0) {
      alerts.push({
        type: totalCaptchaIncidents >= 5 ? 'error' : 'warning',
        message: `${totalCaptchaIncidents} CAPTCHA incident${totalCaptchaIncidents > 1 ? 's' : ''} detected`,
        metric: 'captcha_incidents',
        value: totalCaptchaIncidents
      });
    }
    if (unresolvedCaptcha > 0) {
      alerts.push({
        type: 'error',
        message: `${unresolvedCaptcha} unresolved CAPTCHA incident${unresolvedCaptcha > 1 ? 's' : ''} require attention`,
        metric: 'unresolved_captcha',
        value: unresolvedCaptcha
      });
    }
    if (recentCaptchaRate > 5) {
      alerts.push({
        type: 'warning',
        message: `High CAPTCHA detection rate: ${recentCaptchaRate.toFixed(1)}% of jobs`,
        metric: 'captcha_rate',
        value: recentCaptchaRate
      });
    }

    res.json({
      success: true,
      data: {
        system_status: systemStatus,
        metrics: {
          job_success_rate: parseFloat(successRate.toFixed(1)),
          total_jobs_24h: totalJobs,
          retry_success_rate: parseFloat(retrySuccessRate.toFixed(1)),
          failed_proxies: failedProxies,
          total_proxies: uniqueProxies,
          dedup_blocks_24h: dedupBlocks.length,
          captcha_incidents_24h: totalCaptchaIncidents, // 🆕 CAPTCHA metrics
          unresolved_captcha: unresolvedCaptcha,
          captcha_detection_rate: parseFloat(recentCaptchaRate.toFixed(1))
        },
        alerts,
        last_updated: new Date().toISOString(),
        next_refresh: new Date(Date.now() + 60 * 1000).toISOString() // 60 seconds
      }
    });

  } catch (error) {
    console.error('System summary error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch system summary' 
    });
  }
}));

// 🆕 ===============================================
// 6. CAPTCHA Incidents Endpoint
// ===============================================
router.get('/stats/captcha-incidents', asyncHandler(async (req: any, res: any) => {
  try {
    const timeRange = parseInt(req.query.hours as string) || 24;
    const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();

    // Get recent CAPTCHA incidents with user information
    const { data: incidents, error } = await supabase
      .from('puppet_captcha_incidents')
      .select(`
        *,
        users!inner(email)
      `)
      .gte('detected_at', cutoffTime)
      .order('detected_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`CAPTCHA incidents error: ${error.message}`);
    }

    // Process incident data
    const processedIncidents = incidents?.map(incident => ({
      id: incident.id,
      user_email: incident.users.email,
      job_id: incident.job_id,
      proxy_id: incident.proxy_id,
      captcha_type: incident.captcha_type,
      detection_method: incident.detection_method,
      page_url: incident.page_url,
      screenshot_url: incident.screenshot_url,
      detected_at: incident.detected_at,
      incident_status: incident.incident_status,
      admin_acknowledged: incident.admin_acknowledged,
      cooldown_until: incident.cooldown_until,
      cooldown_active: incident.cooldown_until ? new Date(incident.cooldown_until) > new Date() : false,
      hours_since_detection: Math.floor((Date.now() - new Date(incident.detected_at).getTime()) / (60 * 60 * 1000)),
      severity: incident.captcha_type === 'checkpoint_challenge' ? 'high' : 
               incident.captcha_type === 'linkedin_captcha' ? 'high' : 'medium'
    })) || [];

    // Calculate statistics
    const stats = {
      total_incidents: processedIncidents.length,
      by_type: processedIncidents.reduce((acc, inc) => {
        acc[inc.captcha_type] = (acc[inc.captcha_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      by_status: processedIncidents.reduce((acc, inc) => {
        acc[inc.incident_status] = (acc[inc.incident_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      unresolved_count: processedIncidents.filter(inc => 
        ['detected', 'acknowledged', 'investigating'].includes(inc.incident_status)
      ).length,
      active_cooldowns: processedIncidents.filter(inc => inc.cooldown_active).length,
      unique_users_affected: new Set(processedIncidents.map(inc => inc.user_email)).size,
      avg_resolution_time_hours: processedIncidents
        .filter(inc => inc.incident_status === 'resolved')
        .reduce((acc, inc, _, arr) => acc + inc.hours_since_detection / arr.length, 0) || 0
    };

    res.json({
      success: true,
      data: {
        incidents: processedIncidents,
        statistics: stats,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('CAPTCHA incidents error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch CAPTCHA incidents' 
    });
  }
}));

export default router; 