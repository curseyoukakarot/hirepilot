import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { inviteWarmupService } from '../../services/puppet/inviteWarmupService';
import { inviteDeduplicationService } from '../../services/puppet/inviteDeduplicationService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PuppetLinkedInRequest {
  linkedin_url: string;
  message?: string;
  rex_mode: 'auto' | 'manual';
  consent_accepted: boolean;
  campaign_id?: string;
  priority?: number;
}

/**
 * Enhanced LinkedIn Request Handler with Invite Deduplication
 * 
 * Now includes:
 * - Progressive daily limit enforcement (5→7→9...→20)
 * - Tier-based user progression tracking  
 * - Warm-up validation before job creation
 * - Invite deduplication to prevent re-sending
 * - Comprehensive audit logging
 */
export default async function puppetLinkedInRequestHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { linkedin_url, message, rex_mode, consent_accepted, campaign_id, priority }: PuppetLinkedInRequest = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate required fields
    if (!linkedin_url) {
      return res.status(400).json({ error: 'LinkedIn URL is required' });
    }

    if (!rex_mode || !['auto', 'manual'].includes(rex_mode)) {
      return res.status(400).json({ error: 'REX mode must be either "auto" or "manual"' });
    }

    // Validate consent acceptance
    if (!consent_accepted) {
      return res.status(400).json({ 
        error: 'You must consent to HirePilot acting on your behalf to automate LinkedIn outreach',
        consent_required: true
      });
    }

    // Validate LinkedIn URL format
    if (!linkedin_url.includes('linkedin.com/in/')) {
      return res.status(400).json({ error: 'Invalid LinkedIn URL format' });
    }

    // Validate message length if provided
    if (message && message.length > 300) {
      return res.status(400).json({ error: 'Message cannot exceed 300 characters' });
    }

    console.log(`[PuppetLinkedIn] Processing request for user ${userId} in ${rex_mode} mode`);

    // 🔄 DEDUPLICATION CHECK: Prevent duplicate invitations to the same profile
    console.log(`🔄 [PuppetLinkedIn] Checking for duplicate invitations to ${linkedin_url}`);
    
    const deduplicationCheck = await inviteDeduplicationService.checkInviteEligibility(
      userId,
      linkedin_url,
      campaign_id || undefined
    );
    
    if (!deduplicationCheck.isAllowed) {
      console.log(`❌ [PuppetLinkedIn] Invitation blocked by deduplication: ${deduplicationCheck.reason}`);
      
      return res.json({
        success: false,
        blocked_by_deduplication: true,
        reason: deduplicationCheck.reason,
        message: deduplicationCheck.message,
        previous_invite_date: deduplicationCheck.previousInviteId ? 'exists' : null,
        previous_status: null, // Not available in new structure
        days_since_last: null, // Not available in new structure
        rule_applied: deduplicationCheck.ruleApplied,
        cooldown_expires_at: deduplicationCheck.cooldownExpiresAt
      });
    }

    console.log(`✅ [PuppetLinkedIn] Deduplication check passed: ${deduplicationCheck.reason}`);

    // 🌡️ WARM-UP VALIDATION: Check if user can send invite based on warm-up limits
    console.log(`🌡️ [PuppetLinkedIn] Validating warm-up limits for user ${userId}`);
    
    const warmupValidation = await inviteWarmupService.validateInviteRequest(userId);
    
    if (!warmupValidation.allowed) {
      console.log(`🚫 [PuppetLinkedIn] Warm-up validation failed: ${warmupValidation.reason}`);
      
      return res.status(429).json({
        error: warmupValidation.reason,
        warmup_limit_reached: true,
        current_tier: warmupValidation.tier,
        current_count: warmupValidation.current_count,
        daily_limit: warmupValidation.daily_limit,
        remaining_today: warmupValidation.remaining_today,
        next_allowed_time: warmupValidation.next_allowed_time?.toISOString()
      });
    }

    console.log(`✅ [PuppetLinkedIn] Warm-up validation passed: ${warmupValidation.remaining_today} invites remaining (${warmupValidation.tier} tier)`);

    // Check/create user's Puppet settings
    let { data: userSettings, error: settingsError } = await supabase
      .from('puppet_user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError && settingsError.code === 'PGRST116') {
      // User settings don't exist, create them
      const { data: newSettings, error: createError } = await supabase
        .from('puppet_user_settings')
        .insert({
          user_id: userId,
          automation_consent: true,
          automation_consent_date: new Date().toISOString(),
          rex_auto_mode_enabled: rex_mode === 'auto',
          daily_connection_limit: warmupValidation.daily_limit // Use warm-up limit
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create user settings: ${createError.message}`);
      }
      userSettings = newSettings;
    } else if (settingsError) {
      throw new Error(`Failed to fetch user settings: ${settingsError.message}`);
    }

    // Update consent if not already granted
    if (!userSettings!.automation_consent) {
      const { error: consentError } = await supabase
        .from('puppet_user_settings')
        .update({
          automation_consent: true,
          automation_consent_date: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (consentError) {
        console.error('Failed to update consent:', consentError);
      }
    }

    // Update REX auto mode setting based on current selection
    if (userSettings!.rex_auto_mode_enabled !== (rex_mode === 'auto')) {
      const { error: modeError } = await supabase
        .from('puppet_user_settings')
        .update({
          rex_auto_mode_enabled: rex_mode === 'auto',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (modeError) {
        console.error('Failed to update REX auto mode:', modeError);
      }
    }

    // Check if user has LinkedIn cookie configured (first in user settings, else in cookies table)
    let hasCookie = Boolean(userSettings!.li_at_cookie);

    if (!hasCookie) {
      const { data: cookieRow, error: cookieErr } = await supabase
        .from('linkedin_cookies')
        .select('session_cookie, status, is_valid')
        .eq('user_id', userId)
        .single();

      if (cookieRow && cookieRow.session_cookie) {
        hasCookie = true;
      }
    }

    if (!hasCookie) {
      return res.status(400).json({ 
        error: 'LinkedIn cookie not configured. Please set up LinkedIn integration first.',
        setup_required: true
      });
    }

    // Check user credits before queuing - Using 10 credits for premium automation feature
    const creditCost = 10;
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('used_credits, remaining_credits')
      .eq('user_id', userId)
      .single();

    if (creditsError) {
      console.error('Error checking user credits:', creditsError);
      return res.status(500).json({ error: 'Failed to check user credits' });
    }

    if (!userCredits || userCredits.remaining_credits < creditCost) {
      return res.status(402).json({ 
        error: `Insufficient credits. Need ${creditCost} credits, have ${userCredits?.remaining_credits || 0}`,
        required: creditCost,
        available: userCredits?.remaining_credits || 0,
        insufficient_credits: true
      });
    }

    // Create job in puppet_jobs table
    const { data: job, error: jobError } = await supabase
      .from('puppet_jobs')
      .insert({
        user_id: userId,
        campaign_id: campaign_id || null,
        linkedin_profile_url: linkedin_url,
        message: message?.trim() || null,
        priority: priority || 5,
        scheduled_at: new Date().toISOString(),
        status: 'pending',
        result_data: {
          rex_mode: rex_mode,
          consent_accepted: consent_accepted,
          source: 'lead_drawer_modal',
          warmup_tier: warmupValidation.tier,
          warmup_validation: {
            current_count: warmupValidation.current_count,
            daily_limit: warmupValidation.daily_limit,
            remaining_today: warmupValidation.remaining_today
          },
          deduplication_check: {
            allowed: deduplicationCheck.isAllowed,
            reason: deduplicationCheck.reason,
            rule_applied: deduplicationCheck.ruleApplied,
            previous_invite_date: deduplicationCheck.previousInviteId,
            previous_status: null, // Not available in new structure
            days_since_last: null // Not available in new structure
          }
        }
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating Puppet job:', jobError);
      return res.status(500).json({ error: 'Failed to queue LinkedIn request' });
    }

    // Deduct credits from user's account
    const { error: updateCreditsError } = await supabase
      .from('user_credits')
      .update({ 
        used_credits: userCredits.used_credits + creditCost,
        remaining_credits: userCredits.remaining_credits - creditCost 
      })
      .eq('user_id', userId);

    if (updateCreditsError) {
      console.error('Error deducting credits:', updateCreditsError);
      
      // Rollback: Remove the job if credit deduction fails
      await supabase
        .from('puppet_jobs')
        .delete()
        .eq('id', job.id);
      
      return res.status(500).json({ error: 'Failed to deduct credits' });
    }

    // 🌡️ WARM-UP TRACKING: Record the invite request (will auto-upgrade tier if eligible)
    try {
      // Note: We record as successful here since the job was queued successfully
      // The actual invite success/failure will be recorded when the job is processed
      await inviteWarmupService.recordInviteSent(userId, true);
      console.log(`📊 [PuppetLinkedIn] Recorded invite request for warm-up tracking`);
    } catch (warmupError) {
      console.error('Error recording warmup stats:', warmupError);
      // Don't fail the request for warmup tracking errors
    }

    // Log the credit usage
    const { error: usageLogError } = await supabase
      .from('credit_usage_log')
      .insert({
        user_id: userId,
        amount: -creditCost,
        type: 'debit',
        usage_type: 'api_usage',
        description: `Puppet LinkedIn request to ${linkedin_url.replace('https://www.linkedin.com/in/', '').replace('/', '')} (${rex_mode} mode, ${warmupValidation.tier} tier)`
      });

    if (usageLogError) {
      console.error('Error logging credit usage:', usageLogError);
      // Don't fail the request for logging errors
    }

    // Log REX activity for audit trail
    const { error: activityError } = await supabase
      .from('rex_activity_log')
      .insert({
        user_id: userId,
        campaign_id: campaign_id,
        activity_type: rex_mode === 'auto' ? 'auto_queue' : 'manual_review',
        activity_description: `LinkedIn request ${rex_mode === 'auto' ? 'auto-queued' : 'manually queued'} via lead drawer (${warmupValidation.tier} tier)`,
        linkedin_profile_url: linkedin_url,
        message_content: message?.trim(),
        puppet_job_id: job.id,
        metadata: {
          rex_mode: rex_mode,
          consent_accepted: consent_accepted,
          source: 'lead_drawer_modal',
          credit_cost: creditCost,
          warmup_tier: warmupValidation.tier,
          warmup_limits: {
            current_count: warmupValidation.current_count,
            daily_limit: warmupValidation.daily_limit,
            remaining_today: warmupValidation.remaining_today
          },
          deduplication: {
            check_passed: deduplicationCheck.isAllowed,
            rule_applied: deduplicationCheck.ruleApplied,
            previous_invite_date: deduplicationCheck.previousInviteId
          }
        }
      });

    if (activityError) {
      console.error('Error logging REX activity:', activityError);
    }

    // Get updated warm-up status for response
    const updatedWarmupStatus = await inviteWarmupService.getUserWarmupStatus(userId);

    // Return success response with comprehensive information
    const response = {
      success: true,
      message: rex_mode === 'auto' 
        ? 'LinkedIn request queued automatically!' 
        : 'LinkedIn request queued for review!',
      job: {
        id: job.id,
        status: job.status,
        scheduled_at: job.scheduled_at,
        rex_mode: rex_mode
      },
      credits: {
        used: creditCost,
        remaining: userCredits.remaining_credits - creditCost
      },
      warmup_status: {
        tier: warmupValidation.tier,
        invites_sent_today: updatedWarmupStatus?.today_invites_sent || warmupValidation.current_count + 1,
        daily_limit: warmupValidation.daily_limit,
        remaining_today: Math.max(0, warmupValidation.remaining_today - 1),
        consecutive_successful_days: updatedWarmupStatus?.consecutive_successful_days || 0
      },
      deduplication: {
        check_passed: deduplicationCheck.isAllowed,
        reason: deduplicationCheck.reason,
        rule_applied: deduplicationCheck.ruleApplied,
        is_new_profile: !deduplicationCheck.previousInviteId
      }
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('Puppet LinkedIn request error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 