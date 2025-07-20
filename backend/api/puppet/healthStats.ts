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

// ===============================================
// 1. Job Queue Statistics
// ===============================================
router.get('/stats/jobs', async (req, res) => {
  try {
    const timeRange = req.query.hours ? parseInt(req.query.hours as string) : 24;
    const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();

    // Get job counts by status
    const { data: jobStats, error: jobError } = await supabase
      .from('puppet_jobs')
      .select('status, final_status, created_at')
      .gte('created_at', cutoffTime);

    if (jobError) {
      throw new Error(`Job stats error: ${jobError.message}`);
    }

    // Get retry backlog
    const { data: retryJobs, error: retryError } = await supabase
      .from('puppet_jobs')
      .select('id, next_retry_at, retry_count')
      .eq('final_status', 'failed')
      .not('next_retry_at', 'is', null)
      .gte('next_retry_at', new Date().toISOString());

    if (retryError) {
      throw new Error(`Retry stats error: ${retryError.message}`);
    }

    // Calculate stats
    const stats = {
      pending: jobStats.filter(j => j.status === 'queued').length,
      in_progress: jobStats.filter(j => j.status === 'running').length,
      completed: jobStats.filter(j => j.final_status === 'completed').length,
      failed: jobStats.filter(j => j.final_status === 'failed' || j.final_status === 'permanently_failed').length,
      total: jobStats.length,
      retry_backlog: retryJobs?.length || 0,
      retry_jobs_ready: retryJobs?.filter(j => new Date(j.next_retry_at) <= new Date()).length || 0
    };

    // Job trend data (hourly breakdown)
    const hourlyTrend = Array.from({ length: 24 }, (_, i) => {
      const hourStart = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
      const hourEnd = new Date(Date.now() - (22 - i) * 60 * 60 * 1000);
      
      const hourJobs = jobStats.filter(job => {
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
});

// ===============================================
// 2. Proxy Health Statistics
// ===============================================
router.get('/stats/proxies', async (req, res) => {
  try {
    const timeRange = 24; // Last 24 hours
    const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();

    // Get proxy assignments and their performance
    const { data: proxyData, error: proxyError } = await supabase
      .from('puppet_proxy_assignments')
      .select(`
        *,
        puppet_jobs!inner(
          id, 
          final_status, 
          created_at,
          users!inner(email)
        )
      `)
      .gte('puppet_jobs.created_at', cutoffTime);

    if (proxyError) {
      throw new Error(`Proxy stats error: ${proxyError.message}`);
    }

    // Aggregate proxy performance
    const proxyStats = new Map();
    
    proxyData?.forEach(assignment => {
      const proxyId = assignment.proxy_id;
      const userEmail = assignment.puppet_jobs?.users?.email || 'Unknown';
      const jobStatus = assignment.puppet_jobs?.final_status;

      if (!proxyStats.has(proxyId)) {
        proxyStats.set(proxyId, {
          proxy_id: proxyId,
          assigned_user: userEmail,
          success_count: 0,
          failure_count: 0,
          total_jobs: 0,
          current_status: assignment.status || 'active',
          last_used: assignment.assigned_at,
          rotation_count: 0
        });
      }

      const stats = proxyStats.get(proxyId);
      stats.total_jobs++;
      
      if (jobStatus === 'completed') {
        stats.success_count++;
      } else if (jobStatus === 'failed' || jobStatus === 'permanently_failed') {
        stats.failure_count++;
      }

      // Update last used time
      if (new Date(assignment.assigned_at) > new Date(stats.last_used)) {
        stats.last_used = assignment.assigned_at;
        stats.assigned_user = userEmail;
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
          healthy_proxies: proxies.filter(p => p.health_status === 'healthy').length,
          warning_proxies: proxies.filter(p => p.health_status === 'warning').length,
          unhealthy_proxies: proxies.filter(p => p.health_status === 'unhealthy').length,
          inactive_proxies: proxies.filter(p => p.health_status === 'inactive').length
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
});

// ===============================================
// 3. Warm-Up Tier Tracking
// ===============================================
router.get('/stats/warmup-tiers', async (req, res) => {
  try {
    const daysBack = 3; // Last 3 days for success rate calculation
    const cutoffTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    // Get user warm-up data with recent job performance
    const { data: warmupData, error: warmupError } = await supabase
      .from('puppet_warmup_tiers')
      .select(`
        *,
        users!inner(email, id),
        puppet_jobs(
          id,
          final_status,
          created_at,
          job_type
        )
      `)
      .gte('puppet_jobs.created_at', cutoffTime);

    if (warmupError) {
      throw new Error(`Warmup stats error: ${warmupError.message}`);
    }

    // Process warm-up tier data
    const tierMap = new Map();
    
    warmupData?.forEach(tierData => {
      const userId = tierData.users.id;
      const userEmail = tierData.users.email;
      
      if (!tierMap.has(userId)) {
        tierMap.set(userId, {
          user_email: userEmail,
          current_tier: tierData.current_tier || 1,
          daily_limit: tierData.daily_limit || 5,
          tier_start_date: tierData.tier_start_date,
          auto_advance_eligible: false,
          recent_jobs: [],
          success_count: 0,
          total_jobs: 0
        });
      }

      const user = tierMap.get(userId);
      
      // Add job data
      if (tierData.puppet_jobs) {
        user.recent_jobs.push(tierData.puppet_jobs);
        user.total_jobs++;
        if (tierData.puppet_jobs.final_status === 'completed') {
          user.success_count++;
        }
      }
    });

    // Calculate success rates and auto-advance eligibility
    const warmupUsers = Array.from(tierMap.values()).map(user => {
      const successRate = user.total_jobs > 0 ? (user.success_count / user.total_jobs) * 100 : 0;
      const daysInTier = user.tier_start_date ? 
        Math.floor((Date.now() - new Date(user.tier_start_date).getTime()) / (24 * 60 * 60 * 1000)) : 0;
      
      // Auto-advance criteria: >80% success rate, at least 7 days in tier, minimum 10 jobs
      const autoAdvanceEligible = successRate > 80 && daysInTier >= 7 && user.total_jobs >= 10;

      return {
        ...user,
        success_rate: successRate.toFixed(1),
        days_in_tier: daysInTier,
        auto_advance_eligible: autoAdvanceEligible,
        recent_job_types: [...new Set(user.recent_jobs.map(j => j.job_type))],
        last_activity: user.recent_jobs.length > 0 ? 
          user.recent_jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at :
          null
      };
    });

    res.json({
      success: true,
      data: {
        users: warmupUsers.sort((a, b) => b.current_tier - a.current_tier || b.total_jobs - a.total_jobs),
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
});

// ===============================================
// 4. Deduplication Warnings
// ===============================================
router.get('/stats/deduped-invites', async (req, res) => {
  try {
    const timeRange = parseInt(req.query.hours as string) || 24;
    const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();

    // Get recent deduplication blocks
    const { data: dedupData, error: dedupError } = await supabase
      .from('puppet_invite_deduplication_log')
      .select(`
        *,
        users!inner(email)
      `)
      .gte('blocked_at', cutoffTime)
      .order('blocked_at', { ascending: false })
      .limit(100);

    if (dedupError) {
      throw new Error(`Deduplication stats error: ${dedupError.message}`);
    }

    // Process deduplication data
    const dedupWarnings = dedupData?.map(entry => ({
      id: entry.id,
      user_email: entry.users.email,
      profile_url: entry.linkedin_profile_url,
      rule_triggered: entry.deduplication_rule || 'Unknown',
      blocked_reason: entry.blocked_reason || 'Duplicate invite detected',
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
});

// ===============================================
// 5. System Health Summary
// ===============================================
router.get('/stats/summary', async (req, res) => {
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
        .from('puppet_proxy_assignments')
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

    if (jobsResult.error || proxiesResult.error || retryResult.error) {
      throw new Error('Failed to fetch system summary data');
    }

    const jobs = jobsResult.data || [];
    const proxies = proxiesResult.data || [];
    const retries = retryResult.data || [];
    const dedupBlocks = dedupResult.data || [];
    const captchaIncidents = captchaResult.data || []; // 🆕 CAPTCHA data

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
});

// 🆕 ===============================================
// 6. CAPTCHA Incidents Endpoint
// ===============================================
router.get('/stats/captcha-incidents', async (req, res) => {
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
});

export default router; 