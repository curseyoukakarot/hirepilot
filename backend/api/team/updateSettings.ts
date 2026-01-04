import { ApiRequest, ApiHandler, ErrorResponse } from '../../types/api';
import { Response } from 'express';
import { supabaseDb } from '../../lib/supabase';
import { getUserTeamContext } from './teamContext';

async function resolveTeamAdminFromCreditSharing(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseDb
      .from('team_credit_sharing')
      .select('team_admin_id')
      .eq('team_member_id', userId)
      .maybeSingle();
    if (error) return null;
    const id = (data as any)?.team_admin_id;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

async function resolveTeamAdminId(params: { teamId: string | null; requesterId: string; requesterRole: string | null }) {
  const normalized = String(params.requesterRole || '').toLowerCase();
  if (['admin', 'team_admin', 'super_admin', 'superadmin'].includes(normalized)) return params.requesterId;
  if (!params.teamId) {
    const admin = await resolveTeamAdminFromCreditSharing(params.requesterId);
    return admin || params.requesterId;
  }
  try {
    const { data } = await supabaseDb
      .from('users')
      .select('id')
      .eq('team_id', params.teamId)
      .in('role', ['admin', 'team_admin', 'super_admin', 'superadmin'] as any)
      .limit(1)
      .maybeSingle();
    return (data as any)?.id || params.requesterId;
  } catch {
    return params.requesterId;
  }
}

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      shareLeads,
      shareCandidates,
      shareDeals,
      shareDealsMembers,
      allowTeamEditing,
      adminViewTeamPool,
      shareAnalytics,
      analyticsTeamPool,
      analyticsAdminViewEnabled,
      analyticsAdminViewUserId
    } = req.body;

    // Resolve team membership (supports both legacy `users.team_id` and newer `team_members`)
    const { teamId, role } = await getUserTeamContext(req.user.id);
    // Team seats may be represented via billing membership (team_credit_sharing) without team_id populated.
    const inferredAdminId = await resolveTeamAdminFromCreditSharing(req.user.id);
    if (!teamId && !inferredAdminId) {
      res.status(403).json({ error: 'User not part of a team' });
      return;
    }

    // Determine role-based permissions
    const normalizedRole = String(role || req.user.role || '').toLowerCase();
    const adminRoles = ['admin', 'team_admin', 'team_admins', 'super_admin', 'superadmin'];
    const memberRoles = [...adminRoles, 'member', 'recruitpro', 'recruit_pro'];
    const isAdminRole = adminRoles.includes(normalizedRole);
    const canUpdateSharing = memberRoles.includes(normalizedRole);

    if (!canUpdateSharing) {
      res.status(403).json({ error: 'Insufficient permissions to update team settings' });
      return;
    }

    const teamAdminId = await resolveTeamAdminId({ teamId, requesterId: req.user.id, requesterRole: normalizedRole });

    // Build update payload (write both keys for compatibility with mixed schema)
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    // These may not exist in all envs; we will retry with column-aware fallbacks.
    if (teamId) updateData.team_id = teamId;
    updateData.team_admin_id = inferredAdminId || teamAdminId;

    if (shareLeads !== undefined) updateData.share_leads = shareLeads;
    if (shareCandidates !== undefined) updateData.share_candidates = shareCandidates;
    if (shareDeals !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can control deals sharing' });
        return;
      }
      updateData.share_deals = !!shareDeals;
    }
    if (shareDealsMembers !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can control member deals pooling' });
        return;
      }
      updateData.share_deals_members = !!shareDealsMembers;
    }
    if (allowTeamEditing !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can change shared editing settings' });
        return;
      }
      updateData.allow_team_editing = allowTeamEditing;
    } else if (shareLeads === false) {
      updateData.allow_team_editing = false;
    }

    if (adminViewTeamPool !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can control team visibility' });
        return;
      }
      updateData.team_admin_view_pool = !!adminViewTeamPool;
    }

    if (shareAnalytics !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can control analytics sharing' });
        return;
      }
      updateData.share_analytics = !!shareAnalytics;
    }

    if (analyticsTeamPool !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can control analytics pooling' });
        return;
      }
      updateData.analytics_team_pool = !!analyticsTeamPool;
    }

    if (analyticsAdminViewEnabled !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can impersonate analytics view' });
        return;
      }
      updateData.analytics_admin_view_enabled = !!analyticsAdminViewEnabled;
      if (!analyticsAdminViewEnabled) {
        updateData.analytics_admin_view_user_id = null;
      }
    }

    if (analyticsAdminViewUserId !== undefined) {
      if (!isAdminRole) {
        res.status(403).json({ error: 'Only team admins can select analytics member view' });
        return;
      }
      updateData.analytics_admin_view_user_id = analyticsAdminViewUserId || null;
    }

    // Try upsert using newer schema (PK team_admin_id). If the constraint/column
    // doesn't exist, fall back to legacy schema (PK team_id).
    const tryUpsert = async (payload: any, onConflict: string) => {
      const { error } = await supabaseDb.from('team_settings').upsert(payload, { onConflict } as any);
      return error as any;
    };

    // Attempt #1: team_admin_id schema
    let updateError: any = await tryUpsert(updateData, 'team_admin_id');
    if (updateError && (updateError.code === '42P10' || updateError.code === '42703')) {
      // Attempt #2: team_id schema
      updateError = await tryUpsert(updateData, 'team_id');
    }
    if (updateError && (updateError.code === '42703' || updateError.code === '42P01')) {
      // Columns may differ between environments; strip key columns and retry with the other one.
      const msg = String(updateError.message || '');
      const missingTeamId = msg.includes('team_id') && msg.includes('does not exist');
      const missingTeamAdminId = msg.includes('team_admin_id') && msg.includes('does not exist');

      if (missingTeamId) {
        const { team_id, ...rest } = updateData;
        updateError = await tryUpsert(rest, 'team_admin_id');
      } else if (missingTeamAdminId) {
        const { team_admin_id, ...rest } = updateData;
        updateError = await tryUpsert(rest, 'team_id');
      }
    }

    if (updateError) {
      throw updateError;
    }

    // Update all existing records to match the new settings
    if (shareLeads !== undefined) {
      await supabaseDb
        .from('leads')
        .update({ shared: shareLeads })
        .eq('user_id', req.user.id);
    }

    if (shareCandidates !== undefined) {
      await supabaseDb
        .from('candidates')
        .update({ shared: shareCandidates })
        .eq('user_id', req.user.id);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating team settings:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to update team settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
