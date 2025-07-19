import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  PuppetAdminJobAction,
  PuppetAdminUserAction,
  PuppetAdminBulkAction,
  PuppetAdminEmergencyAction,
  PuppetAdminActionType
} from '../../types/puppet';
import { logAdminAction } from './puppetMonitor';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Super Admin Controls API (Prompt 7)
 * 
 * Job actions, user management, and emergency controls
 * REQUIRES: super_admin role
 */

/**
 * Execute job action: retry, kill, pause, or add notes
 */
export async function executeJobAction(req: Request, res: Response): Promise<void> {
  try {
    const adminUserId = req.user?.id;
    const { job_id, action, reason, admin_notes }: PuppetAdminJobAction = req.body;

    if (!adminUserId) {
      res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
      return;
    }

    if (!job_id || !action) {
      res.status(400).json({
        success: false,
        error: 'job_id and action are required'
      });
      return;
    }

    console.log(`[Admin] Executing job action: ${action} on job ${job_id}`);

    // Get job details first
    const { data: job, error: jobError } = await supabase
      .from('puppet_jobs')
      .select('*, user_id')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      res.status(404).json({
        success: false,
        error: 'Job not found'
      });
      return;
    }

    let updateData: any = {};
    let actionDescription = '';
    let actionType: PuppetAdminActionType;

    switch (action) {
      case 'retry':
        if (job.status === 'running') {
          res.status(400).json({
            success: false,
            error: 'Cannot retry a job that is currently running'
          });
          return;
        }

        updateData = {
          status: 'pending',
          admin_retry_count: (job.admin_retry_count || 0) + 1,
          error_message: null,
          scheduled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (admin_notes) {
          updateData.admin_notes = admin_notes;
        }

        actionType = 'job_retry';
        actionDescription = `Job ${job_id} manually retried by admin${reason ? ': ' + reason : ''}`;
        break;

      case 'kill':
        if (job.status === 'completed') {
          res.status(400).json({
            success: false,
            error: 'Cannot kill a completed job'
          });
          return;
        }

        updateData = {
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: `Job killed by admin${reason ? ': ' + reason : ''}`,
          updated_at: new Date().toISOString()
        };

        if (admin_notes) {
          updateData.admin_notes = admin_notes;
        }

        actionType = 'job_kill';
        actionDescription = `Job ${job_id} killed by admin${reason ? ': ' + reason : ''}`;
        break;

      case 'pause':
        updateData = {
          paused_by_admin: true,
          paused_by_admin_user: adminUserId,
          paused_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (admin_notes) {
          updateData.admin_notes = admin_notes;
        }

        actionType = 'job_kill'; // Using job_kill for paused jobs
        actionDescription = `Job ${job_id} paused by admin${reason ? ': ' + reason : ''}`;
        break;

      case 'add_notes':
        if (!admin_notes) {
          res.status(400).json({
            success: false,
            error: 'admin_notes is required for add_notes action'
          });
          return;
        }

        updateData = {
          admin_notes: admin_notes,
          updated_at: new Date().toISOString()
        };

        actionType = 'job_retry'; // Using job_retry for notes updates
        actionDescription = `Admin notes added to job ${job_id}`;
        break;

      default:
        res.status(400).json({
          success: false,
          error: 'Invalid action. Must be: retry, kill, pause, or add_notes'
        });
        return;
    }

    // Update the job
    const { error: updateError } = await supabase
      .from('puppet_jobs')
      .update(updateData)
      .eq('id', job_id);

    if (updateError) {
      throw new Error(`Failed to update job: ${updateError.message}`);
    }

    // Log admin action
    await logAdminAction(
      adminUserId,
      actionType,
      actionDescription,
      job_id,
      job.user_id,
      undefined,
      {
        action,
        reason,
        admin_notes,
        previous_status: job.status,
        new_status: updateData.status || job.status
      }
    );

    res.json({
      success: true,
      message: `Job ${action} executed successfully`,
      data: {
        job_id,
        action,
        reason,
        admin_notes
      }
    });

  } catch (error) {
    console.error('[Admin] Job action error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute job action'
    });
  }
}

/**
 * Execute user action: pause, unpause, reset limits, assign proxy
 */
export async function executeUserAction(req: Request, res: Response): Promise<void> {
  try {
    const adminUserId = req.user?.id;
    const { user_id, action, reason, proxy_id }: PuppetAdminUserAction = req.body;

    if (!adminUserId) {
      res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
      return;
    }

    if (!user_id || !action) {
      res.status(400).json({
        success: false,
        error: 'user_id and action are required'
      });
      return;
    }

    console.log(`[Admin] Executing user action: ${action} on user ${user_id}`);

    // Get user details first
    const { data: userSettings, error: userError } = await supabase
      .from('puppet_user_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (userError || !userSettings) {
      res.status(404).json({
        success: false,
        error: 'User settings not found'
      });
      return;
    }

    // Get user email separately
    const { data: userData, error: userDataError } = await supabase
      .from('auth.users')
      .select('email')
      .eq('id', user_id)
      .single();

    const userEmail = userData?.email || 'Unknown user';

    let updateData: any = {};
    let actionDescription = '';
    let actionType: PuppetAdminActionType;

    switch (action) {
      case 'pause':
        updateData = {
          admin_paused: true,
          admin_paused_reason: reason || 'Paused by admin',
          admin_paused_by: adminUserId,
          admin_paused_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        actionType = 'user_pause';
        actionDescription = `User ${userEmail} paused by admin${reason ? ': ' + reason : ''}`;
        break;

      case 'unpause':
        updateData = {
          admin_paused: false,
          admin_paused_reason: null,
          admin_paused_by: null,
          admin_paused_at: null,
          updated_at: new Date().toISOString()
        };

        actionType = 'user_unpause';
        actionDescription = `User ${userEmail} unpaused by admin${reason ? ': ' + reason : ''}`;
        break;

      case 'reset_limits':
        // Reset daily stats for today
        const today = new Date().toISOString().split('T')[0];
        
        const { error: resetError } = await supabase
          .from('puppet_daily_stats')
          .update({
            connections_sent: 0,
            messages_sent: 0,
            jobs_completed: 0,
            jobs_failed: 0,
            jobs_warned: 0,
            captcha_detections: 0,
            security_warnings: 0,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id)
          .eq('stat_date', today);

        if (resetError) {
          throw new Error(`Failed to reset daily stats: ${resetError.message}`);
        }

        updateData = {
          updated_at: new Date().toISOString()
        };

        actionType = 'user_unpause'; // Using user_unpause for limit resets
        actionDescription = `Daily limits reset for user ${userEmail}${reason ? ': ' + reason : ''}`;
        break;

      case 'assign_proxy':
        if (!proxy_id) {
          res.status(400).json({
            success: false,
            error: 'proxy_id is required for assign_proxy action'
          });
          return;
        }

        // Verify proxy exists
        const { data: proxy, error: proxyError } = await supabase
          .from('puppet_proxies')
          .select('*')
          .eq('id', proxy_id)
          .single();

        if (proxyError || !proxy) {
          res.status(404).json({
            success: false,
            error: 'Proxy not found'
          });
          return;
        }

        updateData = {
          proxy_id: proxy_id,
          updated_at: new Date().toISOString()
        };

        actionType = 'proxy_manage';
        actionDescription = `Proxy ${proxy.proxy_provider} (${proxy.proxy_location}) assigned to user ${userEmail}`;
        break;

      default:
        res.status(400).json({
          success: false,
          error: 'Invalid action. Must be: pause, unpause, reset_limits, or assign_proxy'
        });
        return;
    }

    // Update the user settings
    const { error: updateError } = await supabase
      .from('puppet_user_settings')
      .update(updateData)
      .eq('user_id', user_id);

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    // Log admin action
    await logAdminAction(
      adminUserId,
      actionType,
      actionDescription,
      undefined,
      user_id,
      proxy_id,
             {
         action,
         reason,
         proxy_id,
         user_email: userEmail
       }
    );

    res.json({
      success: true,
      message: `User ${action} executed successfully`,
      data: {
        user_id,
        action,
        reason,
        proxy_id
      }
    });

  } catch (error) {
    console.error('[Admin] User action error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute user action'
    });
  }
}

/**
 * Execute bulk actions on multiple jobs/users
 */
export async function executeBulkAction(req: Request, res: Response): Promise<void> {
  try {
    const adminUserId = req.user?.id;
    const { action, target_ids, reason }: PuppetAdminBulkAction = req.body;

    if (!adminUserId) {
      res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
      return;
    }

    if (!action || !target_ids || target_ids.length === 0) {
      res.status(400).json({
        success: false,
        error: 'action and target_ids are required'
      });
      return;
    }

    console.log(`[Admin] Executing bulk action: ${action} on ${target_ids.length} targets`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    let actionDescription = '';
    let actionType: PuppetAdminActionType = 'bulk_action';

    switch (action) {
      case 'pause_users':
        for (const userId of target_ids) {
          try {
            const { error } = await supabase
              .from('puppet_user_settings')
              .update({
                admin_paused: true,
                admin_paused_reason: reason || 'Bulk paused by admin',
                admin_paused_by: adminUserId,
                admin_paused_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('user_id', userId);

            if (error) {
              errors.push(`User ${userId}: ${error.message}`);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            errors.push(`User ${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            errorCount++;
          }
        }

        actionDescription = `Bulk pause action on ${target_ids.length} users: ${successCount} successful, ${errorCount} failed`;
        break;

      case 'kill_jobs':
        for (const jobId of target_ids) {
          try {
            const { error } = await supabase
              .from('puppet_jobs')
              .update({
                status: 'cancelled',
                completed_at: new Date().toISOString(),
                error_message: `Bulk killed by admin${reason ? ': ' + reason : ''}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId)
              .neq('status', 'completed'); // Don't kill completed jobs

            if (error) {
              errors.push(`Job ${jobId}: ${error.message}`);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            errors.push(`Job ${jobId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            errorCount++;
          }
        }

        actionDescription = `Bulk kill action on ${target_ids.length} jobs: ${successCount} successful, ${errorCount} failed`;
        break;

      case 'retry_failed':
        for (const jobId of target_ids) {
          try {
                         // First get current admin_retry_count
             const { data: currentJob } = await supabase
               .from('puppet_jobs')
               .select('admin_retry_count')
               .eq('id', jobId)
               .single();

             const { error } = await supabase
               .from('puppet_jobs')
               .update({
                 status: 'pending',
                 admin_retry_count: (currentJob?.admin_retry_count || 0) + 1,
                 error_message: null,
                 scheduled_at: new Date().toISOString(),
                 updated_at: new Date().toISOString()
               })
               .eq('id', jobId)
               .in('status', ['failed', 'warning', 'cancelled']);

            if (error) {
              errors.push(`Job ${jobId}: ${error.message}`);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            errors.push(`Job ${jobId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            errorCount++;
          }
        }

        actionDescription = `Bulk retry action on ${target_ids.length} failed jobs: ${successCount} successful, ${errorCount} failed`;
        break;

      case 'clear_warnings':
        for (const jobId of target_ids) {
          try {
                         // First get current error message
             const { data: currentJob } = await supabase
               .from('puppet_jobs')
               .select('error_message')
               .eq('id', jobId)
               .single();

             const { error } = await supabase
               .from('puppet_jobs')
               .update({
                 status: 'failed', // Convert warnings to failed for cleanup
                 error_message: (currentJob?.error_message || '') + ' (Warning cleared by admin)',
                 updated_at: new Date().toISOString()
               })
               .eq('id', jobId)
               .eq('status', 'warning');

            if (error) {
              errors.push(`Job ${jobId}: ${error.message}`);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            errors.push(`Job ${jobId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            errorCount++;
          }
        }

        actionDescription = `Bulk clear warnings action on ${target_ids.length} jobs: ${successCount} successful, ${errorCount} failed`;
        break;

      default:
        res.status(400).json({
          success: false,
          error: 'Invalid action. Must be: pause_users, kill_jobs, retry_failed, or clear_warnings'
        });
        return;
    }

    // Log bulk admin action
    await logAdminAction(
      adminUserId,
      actionType,
      actionDescription,
      undefined,
      undefined,
      undefined,
      {
        action,
        target_ids,
        reason,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.slice(0, 10) // Log first 10 errors
      },
      successCount > 0,
      errors.length > 0 ? `${errorCount} failures occurred` : undefined
    );

    res.json({
      success: successCount > 0,
      message: `Bulk action completed: ${successCount} successful, ${errorCount} failed`,
      data: {
        action,
        target_count: target_ids.length,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.slice(0, 5) // Return first 5 errors
      }
    });

  } catch (error) {
    console.error('[Admin] Bulk action error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute bulk action'
    });
  }
}

/**
 * Emergency controls: shutdown, maintenance mode
 */
export async function executeEmergencyAction(req: Request, res: Response): Promise<void> {
  try {
    const adminUserId = req.user?.id;
    const { action, reason, maintenance_message, scheduled_until }: PuppetAdminEmergencyAction = req.body;

    if (!adminUserId) {
      res.status(401).json({
        success: false,
        error: 'Admin authentication required'
      });
      return;
    }

    if (!action) {
      res.status(400).json({
        success: false,
        error: 'action is required'
      });
      return;
    }

    console.log(`[Admin] Executing emergency action: ${action}`);

    let actionDescription = '';
    let actionType: PuppetAdminActionType;
    let result: any;

    switch (action) {
      case 'emergency_shutdown':
        result = await supabase
          .rpc('toggle_puppet_emergency_shutdown', {
            enable_shutdown: true,
            reason: reason || 'Emergency shutdown by admin',
            admin_user_id: adminUserId
          });

        if (result.error) {
          throw new Error(`Failed to activate emergency shutdown: ${result.error.message}`);
        }

        actionType = 'emergency_shutdown';
        actionDescription = `Emergency shutdown activated${reason ? ': ' + reason : ''}`;
        break;

      case 'disable_shutdown':
        result = await supabase
          .rpc('toggle_puppet_emergency_shutdown', {
            enable_shutdown: false,
            reason: reason || 'Shutdown disabled by admin',
            admin_user_id: adminUserId
          });

        if (result.error) {
          throw new Error(`Failed to disable emergency shutdown: ${result.error.message}`);
        }

        actionType = 'shutdown_disable';
        actionDescription = `Emergency shutdown disabled${reason ? ': ' + reason : ''}`;
        break;

      case 'maintenance_mode':
        const isEnabling = maintenance_message !== undefined;
        
        const { error: maintenanceError } = await supabase
          .from('puppet_admin_controls')
          .update({
            maintenance_mode: isEnabling,
            maintenance_message: isEnabling ? maintenance_message : null,
            maintenance_scheduled_until: isEnabling && scheduled_until ? scheduled_until : null,
            updated_at: new Date().toISOString()
          });

        if (maintenanceError) {
          throw new Error(`Failed to update maintenance mode: ${maintenanceError.message}`);
        }

        actionType = isEnabling ? 'maintenance_enable' : 'maintenance_disable';
        actionDescription = isEnabling 
          ? `Maintenance mode enabled${maintenance_message ? ': ' + maintenance_message : ''}`
          : `Maintenance mode disabled${reason ? ': ' + reason : ''}`;

        // Log the maintenance action separately
        await logAdminAction(
          adminUserId,
          actionType,
          actionDescription,
          undefined,
          undefined,
          undefined,
          {
            action,
            reason,
            maintenance_message,
            scheduled_until,
            enabled: isEnabling
          }
        );

        result = { data: { success: true, maintenance_mode: isEnabling } };
        break;

      default:
        res.status(400).json({
          success: false,
          error: 'Invalid action. Must be: emergency_shutdown, disable_shutdown, or maintenance_mode'
        });
        return;
    }

    res.json({
      success: true,
      message: actionDescription,
      data: result.data || {
        action,
        reason,
        maintenance_message,
        scheduled_until
      }
    });

  } catch (error) {
    console.error('[Admin] Emergency action error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute emergency action'
    });
  }
}

export default {
  executeJobAction,
  executeUserAction,
  executeBulkAction,
  executeEmergencyAction
}; 