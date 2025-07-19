/**
 * Admin API Endpoints for Invite Deduplication Management
 * Allows admins to view invite history, manage rules, and create overrides
 */

import { Request, Response } from 'express';
import { InviteDeduplicationService } from '../../services/puppet/inviteDeduplicationService';
import { supabase } from '../../lib/supabase';

/**
 * GET /api/admin/deduplication/invites
 * Get invite history with filters and pagination
 */
export async function getInviteHistory(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const {
      user_id,
      status,
      campaign_id,
      profile_url,
      start_date,
      end_date,
      limit = '50',
      offset = '0',
      sort_by = 'sent_at',
      sort_order = 'desc'
    } = req.query;

    // Build query
    let query = supabase
      .from('linkedin_sent_invites')
      .select(`
        *,
        auth.users!inner(email, user_metadata)
      `)
      .order(sort_by as string, { ascending: sort_order === 'asc' })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    // Apply filters
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id);
    }
    if (profile_url) {
      const normalizedUrl = InviteDeduplicationService.normalizeLinkedInUrl(profile_url as string);
      query = query.eq('normalized_profile_url', normalizedUrl);
    }
    if (start_date) {
      query = query.gte('sent_at', start_date);
    }
    if (end_date) {
      query = query.lte('sent_at', end_date);
    }

    const { data: invites, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch invite history: ${error.message}`);
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('linkedin_sent_invites')
      .select('id', { count: 'exact', head: true });

    // Apply same filters for count
    if (user_id) countQuery = countQuery.eq('user_id', user_id);
    if (status) countQuery = countQuery.eq('status', status);
    if (campaign_id) countQuery = countQuery.eq('campaign_id', campaign_id);
    if (profile_url) {
      const normalizedUrl = InviteDeduplicationService.normalizeLinkedInUrl(profile_url as string);
      countQuery = countQuery.eq('normalized_profile_url', normalizedUrl);
    }
    if (start_date) countQuery = countQuery.gte('sent_at', start_date);
    if (end_date) countQuery = countQuery.lte('sent_at', end_date);

    const { count } = await countQuery;

    res.json({
      success: true,
      data: invites,
      pagination: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    console.error('Error fetching invite history:', error);
    res.status(500).json({
      error: 'Failed to fetch invite history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/admin/deduplication/stats
 * Get overall deduplication statistics
 */
export async function getDeduplicationStats(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Get overall stats from view
    const { data: summaryStats, error: summaryError } = await supabase
      .from('invite_deduplication_summary')
      .select('*');

    if (summaryError) {
      throw new Error(`Failed to fetch summary stats: ${summaryError.message}`);
    }

    // Get recent deduplication blocks
    const { data: recentBlocks, error: blocksError } = await supabase
      .from('invite_deduplication_log')
      .select(`
        *,
        auth.users!inner(email)
      `)
      .eq('action', 'blocked')
      .order('checked_at', { ascending: false })
      .limit(20);

    if (blocksError) {
      throw new Error(`Failed to fetch recent blocks: ${blocksError.message}`);
    }

    // Calculate aggregated stats
    const totalUsers = summaryStats?.length || 0;
    const totalInvites = summaryStats?.reduce((sum: number, user: any) => sum + (user.total_invites || 0), 0) || 0;
    const totalAccepted = summaryStats?.reduce((sum: number, user: any) => sum + (user.accepted_count || 0), 0) || 0;
    const totalBlocked = summaryStats?.reduce((sum: number, user: any) => sum + (user.duplicates_blocked_30d || 0), 0) || 0;
    const avgAcceptanceRate = totalUsers > 0 
      ? summaryStats?.reduce((sum: number, user: any) => sum + (user.acceptance_rate_percent || 0), 0) / totalUsers 
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          total_users: totalUsers,
          total_invites: totalInvites,
          total_accepted: totalAccepted,
          total_blocked_30d: totalBlocked,
          avg_acceptance_rate: Math.round(avgAcceptanceRate * 100) / 100
        },
        user_summaries: summaryStats,
        recent_blocks: recentBlocks
      }
    });

  } catch (error) {
    console.error('Error fetching deduplication stats:', error);
    res.status(500).json({
      error: 'Failed to fetch deduplication stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/admin/deduplication/rules
 * Get deduplication rules
 */
export async function getDeduplicationRules(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { active_only = 'true' } = req.query;

    const rules = await InviteDeduplicationService.getDeduplicationRules(active_only === 'true');

    res.json({
      success: true,
      data: rules
    });

  } catch (error) {
    console.error('Error fetching deduplication rules:', error);
    res.status(500).json({
      error: 'Failed to fetch deduplication rules',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * PUT /api/admin/deduplication/rules/:ruleId
 * Update a deduplication rule
 */
export async function updateDeduplicationRule(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { ruleId } = req.params;
    const {
      rule_name,
      invite_status,
      is_active,
      cooldown_days,
      is_permanent_block,
      priority,
      description
    } = req.body;

    // Validate required fields
    if (cooldown_days !== undefined && (cooldown_days < 0 || cooldown_days > 365)) {
      res.status(400).json({ error: 'Cooldown days must be between 0 and 365' });
      return;
    }

    if (is_permanent_block && cooldown_days > 0) {
      res.status(400).json({ error: 'Permanent blocks cannot have cooldown days' });
      return;
    }

    const updateData: any = {};
    if (rule_name !== undefined) updateData.rule_name = rule_name;
    if (invite_status !== undefined) updateData.invite_status = invite_status;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (cooldown_days !== undefined) updateData.cooldown_days = cooldown_days;
    if (is_permanent_block !== undefined) updateData.is_permanent_block = is_permanent_block;
    if (priority !== undefined) updateData.priority = priority;
    if (description !== undefined) updateData.description = description;

    updateData.updated_at = new Date().toISOString();

    const { data: rule, error } = await supabase
      .from('invite_deduplication_rules')
      .update(updateData)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update rule: ${error.message}`);
    }

    res.json({
      success: true,
      message: 'Deduplication rule updated successfully',
      data: rule
    });

  } catch (error) {
    console.error('Error updating deduplication rule:', error);
    res.status(500).json({
      error: 'Failed to update deduplication rule',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/deduplication/overrides
 * Create an admin override for deduplication
 */
export async function createDeduplicationOverride(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const {
      user_id,
      profile_url,
      override_type = 'one_time',
      reason,
      expires_at
    } = req.body;

    // Validate required fields
    if (!user_id || !profile_url || !reason) {
      res.status(400).json({ error: 'user_id, profile_url, and reason are required' });
      return;
    }

    // Validate LinkedIn URL
    if (!InviteDeduplicationService.isLinkedInProfileUrl(profile_url)) {
      res.status(400).json({ error: 'Invalid LinkedIn profile URL' });
      return;
    }

    // Validate override type
    if (!['one_time', 'permanent', 'temporary'].includes(override_type)) {
      res.status(400).json({ error: 'override_type must be one_time, permanent, or temporary' });
      return;
    }

    // Validate expires_at for temporary overrides
    if (override_type === 'temporary' && !expires_at) {
      res.status(400).json({ error: 'expires_at is required for temporary overrides' });
      return;
    }

    const overrideId = await InviteDeduplicationService.createAdminOverride(
      user_id,
      profile_url,
      override_type,
      reason,
      user.id,
      expires_at ? new Date(expires_at) : undefined
    );

    res.json({
      success: true,
      message: 'Deduplication override created successfully',
      data: { override_id: overrideId }
    });

  } catch (error) {
    console.error('Error creating deduplication override:', error);
    res.status(500).json({
      error: 'Failed to create deduplication override',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/admin/deduplication/overrides
 * Get active deduplication overrides
 */
export async function getDeduplicationOverrides(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { active_only = 'true', limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('invite_deduplication_overrides')
      .select(`
        *,
        users:user_id(email),
        created_by_user:created_by(email)
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (active_only === 'true') {
      query = query.eq('is_used', false)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    }

    const { data: overrides, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch overrides: ${error.message}`);
    }

    res.json({
      success: true,
      data: overrides
    });

  } catch (error) {
    console.error('Error fetching deduplication overrides:', error);
    res.status(500).json({
      error: 'Failed to fetch deduplication overrides',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * DELETE /api/admin/deduplication/overrides/:overrideId
 * Delete a deduplication override
 */
export async function deleteDeduplicationOverride(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { overrideId } = req.params;

    const { error } = await supabase
      .from('invite_deduplication_overrides')
      .delete()
      .eq('id', overrideId);

    if (error) {
      throw new Error(`Failed to delete override: ${error.message}`);
    }

    res.json({
      success: true,
      message: 'Deduplication override deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting deduplication override:', error);
    res.status(500).json({
      error: 'Failed to delete deduplication override',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/admin/deduplication/logs
 * Get deduplication decision logs
 */
export async function getDeduplicationLogs(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const {
      user_id,
      action,
      reason,
      start_date,
      end_date,
      limit = '100',
      offset = '0'
    } = req.query;

    const logs = await InviteDeduplicationService.getRecentDeduplicationLogs(
      user_id as string | undefined,
      parseInt(limit as string)
    );

    // Apply additional filters if needed
    let filteredLogs = logs;

    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }
    if (reason) {
      filteredLogs = filteredLogs.filter(log => log.reason === reason);
    }
    if (start_date) {
      filteredLogs = filteredLogs.filter(log => new Date(log.checked_at) >= new Date(start_date as string));
    }
    if (end_date) {
      filteredLogs = filteredLogs.filter(log => new Date(log.checked_at) <= new Date(end_date as string));
    }

    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        total: filteredLogs.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    console.error('Error fetching deduplication logs:', error);
    res.status(500).json({
      error: 'Failed to fetch deduplication logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/deduplication/check
 * Check deduplication status for a user/profile combination
 */
export async function checkDeduplicationStatus(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { user_id, profile_url, campaign_id } = req.body;

    // Validate required fields
    if (!user_id || !profile_url) {
      res.status(400).json({ error: 'user_id and profile_url are required' });
      return;
    }

    // Validate LinkedIn URL
    if (!InviteDeduplicationService.isLinkedInProfileUrl(profile_url)) {
      res.status(400).json({ error: 'Invalid LinkedIn profile URL' });
      return;
    }

    const result = await InviteDeduplicationService.checkInviteDeduplication(
      user_id,
      profile_url,
      campaign_id
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error checking deduplication status:', error);
    res.status(500).json({
      error: 'Failed to check deduplication status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * PUT /api/admin/deduplication/invites/:inviteId/status
 * Update invite status manually
 */
export async function updateInviteStatus(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { inviteId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['sent', 'accepted', 'rejected', 'expired', 'withdrawn', 'pending'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const success = await InviteDeduplicationService.updateInviteStatus(
      inviteId,
      status,
      user.id
    );

    if (!success) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    res.json({
      success: true,
      message: `Invite status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating invite status:', error);
    res.status(500).json({
      error: 'Failed to update invite status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/admin/deduplication/user/:userId/summary
 * Get deduplication summary for a specific user
 */
export async function getUserDeduplicationSummary(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { userId } = req.params;

    const [summary, cooldowns] = await Promise.all([
      InviteDeduplicationService.getUserDeduplicationSummary(userId),
      InviteDeduplicationService.getUserActiveCooldowns(userId, 20)
    ]);

    res.json({
      success: true,
      data: {
        summary,
        active_cooldowns: cooldowns
      }
    });

  } catch (error) {
    console.error('Error fetching user deduplication summary:', error);
    res.status(500).json({
      error: 'Failed to fetch user deduplication summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/deduplication/batch-check
 * Batch check deduplication for multiple profiles
 */
export async function batchCheckDeduplication(req: Request, res: Response): Promise<void> {
  try {
    // Check admin permissions
    const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.replace('Bearer ', ''));
    if (!user || !['super_admin', 'admin'].includes(user.user_metadata?.role)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { user_id, profile_urls, campaign_id } = req.body;

    // Validate required fields
    if (!user_id || !profile_urls || !Array.isArray(profile_urls)) {
      res.status(400).json({ error: 'user_id and profile_urls array are required' });
      return;
    }

    // Limit batch size
    if (profile_urls.length > 50) {
      res.status(400).json({ error: 'Maximum 50 profiles per batch' });
      return;
    }

    // Validate all URLs
    for (const url of profile_urls) {
      if (!InviteDeduplicationService.isLinkedInProfileUrl(url)) {
        res.status(400).json({ error: `Invalid LinkedIn profile URL: ${url}` });
        return;
      }
    }

    const results = await InviteDeduplicationService.batchCheckDeduplication(
      user_id,
      profile_urls,
      campaign_id
    );

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error in batch deduplication check:', error);
    res.status(500).json({
      error: 'Failed to perform batch deduplication check',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 