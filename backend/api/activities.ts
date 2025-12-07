import { Router, Response } from 'express';
import { ApiRequest } from '../types/api';
import { requireAuth } from '../middleware/authMiddleware';
import { supabaseDb as supabase } from '../lib/supabase';

const router = Router();

const ADMIN_ROLE_SET = new Set(['admin','team_admin','team_admins','super_admin','SuperAdmin']);

type TeamSharingSettings = {
  share_leads: boolean;
  share_candidates: boolean;
  allow_team_editing: boolean;
  team_admin_view_pool: boolean;
};

const DEFAULT_TEAM_SETTINGS: TeamSharingSettings = {
  share_leads: false,
  share_candidates: false,
  allow_team_editing: false,
  team_admin_view_pool: true
};

async function fetchTeamSettings(teamId?: string | null): Promise<TeamSharingSettings> {
  if (!teamId) return DEFAULT_TEAM_SETTINGS;
  const { data } = await supabase
    .from('team_settings')
    .select('share_leads, share_candidates, allow_team_editing, team_admin_view_pool')
    .eq('team_id', teamId)
    .maybeSingle();
  return {
    share_leads: !!data?.share_leads,
    share_candidates: !!data?.share_candidates,
    allow_team_editing: !!data?.allow_team_editing,
    team_admin_view_pool:
      data?.team_admin_view_pool === undefined || data?.team_admin_view_pool === null
        ? true
        : !!data?.team_admin_view_pool
  };
}

async function resolveLeadViewerContext(viewerId: string, ownerId: string) {
  const [viewerRes, ownerRes] = await Promise.all([
    supabase.from('users').select('id, team_id, role').eq('id', viewerId).maybeSingle(),
    supabase.from('users').select('id, team_id').eq('id', ownerId).maybeSingle()
  ]);
  const viewer = viewerRes?.data;
  const owner = ownerRes?.data;
  const sameTeam = Boolean(viewer?.team_id && owner?.team_id && viewer.team_id === owner.team_id);
  const teamSettings = sameTeam && owner?.team_id ? await fetchTeamSettings(owner.team_id) : DEFAULT_TEAM_SETTINGS;
  const privileged = ADMIN_ROLE_SET.has(String(viewer?.role || '').toLowerCase());
  return { sameTeam, teamSettings, privileged };
}

/**
 * GET /api/activities?entity_type=lead|candidate&entity_id=<uuid>
 * Unified endpoint for fetching activities for both leads and candidates
 */
router.get('/', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { entity_type, entity_id } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User authentication required' 
      });
    }

    if (!entity_type || !entity_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: entity_type and entity_id' 
      });
    }

    if (!['lead', 'candidate'].includes(entity_type as string)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid entity_type. Must be "lead" or "candidate"' 
      });
    }

    let activities: any[] = [];

    if (entity_type === 'lead') {
      // Verify user can access the lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, user_id')
        .eq('id', entity_id)
        .single();

      if (leadError || !lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      if (lead.user_id !== userId) {
        const { sameTeam, teamSettings, privileged } = await resolveLeadViewerContext(userId, lead.user_id);
        const adminOverride = privileged && sameTeam && teamSettings.team_admin_view_pool;
        const shareViewAllowed = sameTeam && (teamSettings.share_leads || adminOverride);

        let hasCandidateAccess = false;
        if (!(privileged && sameTeam) && !shareViewAllowed) {
          const { data: candidate } = await supabase
            .from('candidates')
            .select('id')
            .eq('lead_id', entity_id)
            .eq('user_id', userId)
            .single();
          hasCandidateAccess = Boolean(candidate);
        }

        if (!(privileged && sameTeam) && !shareViewAllowed && !hasCandidateAccess) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      // Get lead activities
      const { data: leadActivities, error } = await supabase
        .from('lead_activities')
        .select(`
          id,
          activity_type,
          tags,
          notes,
          activity_timestamp,
          created_at,
          updated_at
        `)
        .eq('lead_id', entity_id)
        .order('activity_timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching lead activities:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch activities' 
        });
      }

      activities = (leadActivities || []).map(a => ({
        ...a,
        origin: 'lead'
      }));

      // Also include candidate activities for the current user's candidates linked to this lead
      try {
        const { data: candidateRows } = await supabase
          .from('candidates')
          .select('id, user_id')
          .eq('lead_id', entity_id);

        const userCandidateIds = (candidateRows || [])
          .filter(c => c.user_id === userId)
          .map(c => c.id);

        if (userCandidateIds.length > 0) {
          const { data: candActs, error: candErr } = await supabase
            .from('candidate_activities')
            .select('id, candidate_id, job_id, status, notes, created_at, created_by')
            .in('candidate_id', userCandidateIds)
            .order('created_at', { ascending: false });

          if (!candErr && candActs) {
            const normalized = candActs.map(a => ({
              id: `cand-${a.id}`,
              activity_type: 'Candidate',
              tags: a.status ? [a.status] : [],
              notes: a.notes || null,
              activity_timestamp: a.created_at,
              created_at: a.created_at,
              updated_at: a.created_at,
              origin: 'candidate'
            }));
            activities = activities.concat(normalized);
          }
        }
      } catch (e) {
        console.warn('Candidate activities merge warning:', e);
      }

    } else if (entity_type === 'candidate') {
      // Verify user can access the candidate
      const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .select('id, user_id, lead_id')
        .eq('id', entity_id)
        .single();

      if (candidateError || !candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
      }

      // Check if user can access this candidate (own or team member)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('team_id, role')
        .eq('id', userId)
        .single();

      if (userError) {
        return res.status(500).json({ success: false, message: 'Failed to fetch user data' });
      }

      const isAdmin = ['admin', 'team_admin', 'super_admin'].includes(userData.role);
      const canAccess = candidate.user_id === userId || 
        (userData.team_id && isAdmin) ||
        (userData.team_id && candidate.user_id && 
         await supabase
           .from('users')
           .select('team_id')
           .eq('id', candidate.user_id)
           .eq('team_id', userData.team_id)
           .single()
           .then(({ data }) => !!data));

      if (!canAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      // Get candidate activities
      const { data: candidateActivities, error } = await supabase
        .from('candidate_activities')
        .select(`
          id,
          candidate_id,
          job_id,
          status,
          notes,
          created_at,
          created_by
        `)
        .eq('candidate_id', entity_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching candidate activities:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch activities' 
        });
      }

      activities = (candidateActivities || []).map(a => ({
        id: `cand-${a.id}`,
        activity_type: 'Candidate',
        tags: a.status ? [a.status] : [],
        notes: a.notes || null,
        activity_timestamp: a.created_at,
        created_at: a.created_at,
        updated_at: a.created_at,
        origin: 'candidate'
      }));

      // If candidate has a linked lead, also include lead activities
      if (candidate.lead_id) {
        try {
          const { data: leadActivities, error: leadError } = await supabase
            .from('lead_activities')
            .select(`
              id,
              activity_type,
              tags,
              notes,
              activity_timestamp,
              created_at,
              updated_at
            `)
            .eq('lead_id', candidate.lead_id)
            .order('activity_timestamp', { ascending: false });

          if (!leadError && leadActivities) {
            const normalized = leadActivities.map(a => ({
              ...a,
              origin: 'lead'
            }));
            activities = activities.concat(normalized);
          }
        } catch (e) {
          console.warn('Lead activities merge warning:', e);
        }
      }
    }

    // Sort combined by timestamp desc
    activities.sort((a, b) => new Date(b.activity_timestamp).getTime() - new Date(a.activity_timestamp).getTime());

    res.json({
      success: true,
      activities
    });

  } catch (error) {
    console.error('Error in GET /activities:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router;
