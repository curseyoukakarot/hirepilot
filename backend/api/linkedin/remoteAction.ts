import type { Response } from 'express';
import type { ApiRequest } from '../../src/types/api';
import { canUseRemoteLinkedInActions } from '../../src/services/remoteActions';
import { hasLinkedInCookie } from '../../src/services/linkedin/cookieService';
import { enqueueLinkedInRemoteAction } from '../../src/services/linkedinRemoteActions';
import { supabase } from '../../src/lib/supabase';
import { LinkedInRemoteActionType } from '../../src/services/brightdataBrowser';

interface RemoteActionBody {
  action: LinkedInRemoteActionType;
  linkedinUrl?: string;
  message?: string;
  leadId?: string;
  candidateId?: string;
  triggeredBy?: string;
}

export default async function linkedinRemoteActionHandler(req: ApiRequest, res: Response) {
  try {
    const userId = req.user?.id || (req.headers['x-user-id'] as string | undefined);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const body = req.body as RemoteActionBody;
    if (!body?.action) return res.status(400).json({ error: 'Action is required' });

    const eligibility = await canUseRemoteLinkedInActions(userId);
    if (!eligibility.allowed) {
      return res.status(403).json({ error: eligibility.reason || 'Remote LinkedIn actions disabled.' });
    }

    const hasCookieOnFile = await hasLinkedInCookie(userId);
    if (!hasCookieOnFile) {
      return res.status(412).json({
        error: 'LinkedIn cookie missing. Update it in Settings.',
        action_required: 'refresh_cookie'
      });
    }

    const { leadId, candidateId } = body;
    let linkedinUrl = body.linkedinUrl?.trim();
    let accountId: string | null = null;
    let resolvedLeadId: string | undefined = undefined;
    let resolvedCandidateId: string | undefined = undefined;

    if (leadId) {
      const lead = await fetchLeadForUser(userId, leadId);
      if (!lead) return res.status(404).json({ error: 'Lead not found or access denied' });
      linkedinUrl = linkedinUrl || lead.linkedin_url;
      accountId = lead.account_id || null;
      resolvedLeadId = lead.id;
    }

    if (!resolvedLeadId && candidateId) {
      const candidate = await fetchCandidateForUser(userId, candidateId);
      if (!candidate) return res.status(404).json({ error: 'Candidate not found or access denied' });
      linkedinUrl = linkedinUrl || candidate.linkedin_url;
      resolvedCandidateId = candidate.id;
      accountId = candidate.account_id || accountId || null;
    }

    if (!linkedinUrl) {
      return res.status(400).json({ error: 'LinkedIn URL is required' });
    }

    const rawMessage = typeof body.message === 'string' ? body.message.trim() : undefined;
    const message = rawMessage ? rawMessage.slice(0, 450) : undefined;
    if (body.action === 'send_message' && !message) {
      return res.status(400).json({ error: 'Message is required for LinkedIn messages.' });
    }

    await enqueueLinkedInRemoteAction({
      userId,
      accountId,
      leadId: resolvedLeadId,
      candidateId: resolvedCandidateId,
      action: body.action,
      linkedinUrl,
      message,
      triggeredBy: body.triggeredBy || 'rex'
    });

    return res.status(202).json({ status: 'queued' });
  } catch (err: any) {
    console.error('[LinkedInRemoteActionAPI] Failed to queue action', err);
    return res.status(500).json({ error: 'Failed to queue LinkedIn remote action' });
  }
}

async function fetchLeadForUser(userId: string, leadId: string) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('id, user_id, account_id, linkedin_url')
      .eq('id', leadId)
      .maybeSingle();
    if (error || !data || data.user_id !== userId) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchCandidateForUser(userId: string, candidateId: string) {
  try {
    const { data, error } = await supabase
      .from('candidates')
      .select('id, user_id, account_id, linkedin_url')
      .eq('id', candidateId)
      .maybeSingle();
    if (error || !data || data.user_id !== userId) return null;
    return data;
  } catch {
    return null;
  }
}

