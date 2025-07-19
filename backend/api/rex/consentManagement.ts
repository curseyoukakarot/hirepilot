import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  RexConsentRequest,
  RexAutoModeToggleRequest,
  RexActivityType,
  PuppetUserSettings
} from '../../types/puppet';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Grant or revoke automation consent (Prompt 6)
 * 
 * Handles the consent checkbox in the LinkedIn request modal:
 * "I consent to HirePilot acting on my behalf to automate LinkedIn outreach. 
 * I understand this simulates my own manual usage."
 */
export async function updateAutomationConsent(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id || req.user?.id;
    const { consent_granted, consent_text }: RexConsentRequest = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
      return;
    }

    if (typeof consent_granted !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'consent_granted must be a boolean value'
      });
      return;
    }

    console.log(`[REX] Updating automation consent for user ${userId}: ${consent_granted}`);

    // Prepare consent update data
    const consentData: any = {
      automation_consent: consent_granted,
      updated_at: new Date().toISOString()
    };

    // Set consent date if granting consent
    if (consent_granted) {
      consentData.automation_consent_date = new Date().toISOString();
    } else {
      // Clear consent date and disable auto mode if revoking consent
      consentData.automation_consent_date = null;
      consentData.rex_auto_mode_enabled = false;
    }

    // Update user settings
    const { data: updatedSettings, error: updateError } = await supabase
      .from('puppet_user_settings')
      .update(consentData)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update consent: ${updateError.message}`);
    }

    // Log consent activity
    const activityType: RexActivityType = consent_granted ? 'consent_granted' : 'consent_revoked';
    const activityDescription = consent_granted
      ? 'User granted automation consent for LinkedIn outreach'
      : 'User revoked automation consent for LinkedIn outreach';

    await logRexActivity({
      user_id: userId,
      activity_type: activityType,
      activity_description: activityDescription,
      metadata: {
        consent_text: consent_text || 'Standard consent text',
        consent_timestamp: new Date().toISOString(),
        previous_consent_state: !consent_granted
      }
    });

    res.json({
      success: true,
      message: consent_granted 
        ? 'Automation consent granted successfully'
        : 'Automation consent revoked successfully',
      data: {
        automation_consent: updatedSettings.automation_consent,
        automation_consent_date: updatedSettings.automation_consent_date,
        rex_auto_mode_enabled: updatedSettings.rex_auto_mode_enabled
      }
    });

  } catch (error) {
    console.error('[REX] Consent update error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

/**
 * Toggle REX Auto Mode on/off
 * 
 * Controls whether LinkedIn requests are queued immediately (auto) 
 * or require manual review (manual)
 */
export async function toggleAutoMode(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body.user_id || req.user?.id;
    const { auto_mode_enabled }: RexAutoModeToggleRequest = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
      return;
    }

    if (typeof auto_mode_enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'auto_mode_enabled must be a boolean value'
      });
      return;
    }

    console.log(`[REX] Toggling auto mode for user ${userId}: ${auto_mode_enabled}`);

    // Get current user settings to check consent
    const currentSettings = await getUserSettings(userId);
    
    if (!currentSettings) {
      res.status(404).json({
        success: false,
        error: 'User Puppet settings not found. Please configure REX settings first.'
      });
      return;
    }

    // Check if user has granted automation consent before enabling auto mode
    if (auto_mode_enabled && !currentSettings.automation_consent) {
      res.status(400).json({
        success: false,
        error: 'Automation consent required before enabling auto mode. Please grant consent first.'
      });
      return;
    }

    // Update auto mode setting
    const { data: updatedSettings, error: updateError } = await supabase
      .from('puppet_user_settings')
      .update({
        rex_auto_mode_enabled: auto_mode_enabled,
        auto_mode_enabled: auto_mode_enabled, // Update legacy field for compatibility
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update auto mode: ${updateError.message}`);
    }

    // Log auto mode toggle activity
    const activityType: RexActivityType = auto_mode_enabled ? 'auto_mode_enabled' : 'auto_mode_disabled';
    const activityDescription = auto_mode_enabled
      ? 'REX Auto Mode enabled - LinkedIn requests will be queued immediately'
      : 'REX Auto Mode disabled - LinkedIn requests will require manual review';

    await logRexActivity({
      user_id: userId,
      activity_type: activityType,
      activity_description: activityDescription,
      metadata: {
        previous_auto_mode_state: !auto_mode_enabled,
        toggle_timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: auto_mode_enabled 
        ? 'REX Auto Mode enabled successfully'
        : 'REX Auto Mode disabled successfully',
      data: {
        rex_auto_mode_enabled: updatedSettings.rex_auto_mode_enabled,
        automation_consent: updatedSettings.automation_consent
      }
    });

  } catch (error) {
    console.error('[REX] Auto mode toggle error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get REX settings for a user
 */
export async function getRexSettings(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.query.user_id as string || req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
      return;
    }

    const settings = await getUserSettings(userId);
    
    if (!settings) {
      res.status(404).json({
        success: false,
        error: 'User Puppet settings not found'
      });
      return;
    }

    // Get daily limits info
    const dailyLimitCheck = await checkDailyLimits(userId, settings.daily_connection_limit);

    // Get recent activity count
    const recentActivity = await getRecentActivityCount(userId);

    res.json({
      success: true,
      data: {
        rex_auto_mode_enabled: settings.rex_auto_mode_enabled,
        automation_consent: settings.automation_consent,
        automation_consent_date: settings.automation_consent_date,
        last_manual_review_at: settings.last_manual_review_at,
        daily_connection_limit: settings.daily_connection_limit,
        daily_limit_check: dailyLimitCheck,
        linkedin_configured: !!settings.li_at_cookie,
        recent_activity: recentActivity
      }
    });

  } catch (error) {
    console.error('[REX] Get settings error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

/**
 * Get REX activity log for a user
 */
export async function getRexActivityLog(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.query.user_id as string || req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
      return;
    }

    const { data: activities, error } = await supabase
      .from('rex_activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch activity log: ${error.message}`);
    }

    res.json({
      success: true,
      data: activities || [],
      pagination: {
        limit,
        offset,
        total: activities?.length || 0
      }
    });

  } catch (error) {
    console.error('[REX] Get activity log error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

/**
 * Helper functions
 */

async function getUserSettings(userId: string): Promise<PuppetUserSettings | null> {
  const { data: settings, error } = await supabase
    .from('puppet_user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch user settings: ${error.message}`);
  }

  return settings;
}

async function checkDailyLimits(userId: string, dailyLimit: number): Promise<{
  current: number;
  limit: number;
  remaining: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: stats } = await supabase
    .from('puppet_daily_stats')
    .select('connections_sent')
    .eq('user_id', userId)
    .eq('stat_date', today)
    .single();

  const currentCount = stats?.connections_sent || 0;
  const remaining = Math.max(0, dailyLimit - currentCount);

  return {
    current: currentCount,
    limit: dailyLimit,
    remaining
  };
}

async function getRecentActivityCount(userId: string): Promise<{
  today: number;
  this_week: number;
  manual_reviews: number;
  auto_queued: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: activities } = await supabase
    .from('rex_activity_log')
    .select('activity_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', weekAgo);

  const activityCount = {
    today: 0,
    this_week: activities?.length || 0,
    manual_reviews: 0,
    auto_queued: 0
  };

  activities?.forEach(activity => {
    if (activity.created_at.startsWith(today)) {
      activityCount.today++;
    }
    if (activity.activity_type === 'manual_review') {
      activityCount.manual_reviews++;
    }
    if (activity.activity_type === 'auto_queue') {
      activityCount.auto_queued++;
    }
  });

  return activityCount;
}

async function logRexActivity(data: {
  user_id: string;
  lead_id?: string;
  campaign_id?: string;
  activity_type: RexActivityType;
  activity_description: string;
  linkedin_profile_url?: string;
  message_content?: string;
  puppet_job_id?: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  const { data: activity, error } = await supabase
    .from('rex_activity_log')
    .insert({
      user_id: data.user_id,
      lead_id: data.lead_id,
      campaign_id: data.campaign_id,
      activity_type: data.activity_type,
      activity_description: data.activity_description,
      linkedin_profile_url: data.linkedin_profile_url,
      message_content: data.message_content,
      puppet_job_id: data.puppet_job_id,
      metadata: data.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('[REX] Failed to log activity:', error);
    throw new Error(`Failed to log REX activity: ${error.message}`);
  }

  return activity.id;
}

export default { 
  updateAutomationConsent, 
  toggleAutoMode, 
  getRexSettings, 
  getRexActivityLog 
}; 