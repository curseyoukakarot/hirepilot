/**
 * Add collaborator to job requisition with notifications
 * POST /api/collaborators/add
 * Body: { jobId: string, userId: string, role: string }
 */

import { ApiRequest, ApiHandler, ErrorResponse } from '../../types/api';
import { Response } from 'express';
import { supabaseDb } from '../../lib/supabase';
import { sendSlackNotificationToUser } from '../../lib/slack';
import { sendCollaboratorNotificationEmail } from '../../lib/email';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { jobId, userId, role = 'Editor' } = req.body;

    if (!jobId || !userId) {
      res.status(400).json({ error: 'Missing jobId or userId' });
      return;
    }

    // Check if current user has permission to add collaborators
    const { data: currentUser, error: currentUserError } = await supabaseDb
      .from('users')
      .select('team_id, role')
      .eq('id', req.user.id)
      .single();

    if (currentUserError || !currentUser) {
      res.status(404).json({ error: 'Current user not found' });
      return;
    }

    // Check if job exists and get job details
    const { data: job, error: jobError } = await supabaseDb
      .from('job_requisitions')
      .select('id, title, user_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      res.status(404).json({ error: 'Job requisition not found' });
      return;
    }

    // Check if current user can add collaborators (job owner or team member)
    const isJobOwner = job.user_id === req.user.id;
    const isTeamMember = currentUser.team_id && currentUser.role && ['admin', 'team_admin', 'super_admin'].includes(currentUser.role);
    
    if (!isJobOwner && !isTeamMember) {
      res.status(403).json({ error: 'Insufficient permissions to add collaborators' });
      return;
    }

    // Check if target user exists and get their notification preferences
    const { data: targetUser, error: targetUserError } = await supabaseDb
      .from('users')
      .select('id, email, slack_notifications, email_notifications, team_id')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    // If team-based, ensure both users are in the same team
    if (currentUser.team_id && targetUser.team_id !== currentUser.team_id) {
      res.status(403).json({ error: 'Cannot add collaborator from different team' });
      return;
    }

    // Insert collaborator
    const { data: collaborator, error: insertError } = await supabaseDb
      .from('job_collaborators')
      .insert([{ 
        job_id: jobId, 
        user_id: userId, 
        role: role 
      }])
      .select('job_id, user_id, role')
      .single();

    if (insertError) {
      console.error('Error inserting collaborator:', insertError);
      res.status(500).json({ error: insertError.message });
      return;
    }

    // Send notifications
    const jobTitle = job.title || 'Untitled Job';
    const jobUrl = `${process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.thehirepilot.com'}/job/${jobId}`;

    // Slack notification
    if (targetUser.slack_notifications) {
      await sendSlackNotificationToUser(
        targetUser.email,
        `📌 You've been added as a collaborator to Job Req: *${jobTitle}*`
      );
    }

    // Email notification
    if (targetUser.email_notifications) {
      await sendCollaboratorNotificationEmail(
        targetUser.email,
        jobTitle,
        jobUrl
      );
    }

    // Log activity
    try {
      await supabaseDb.from('job_activity_log').insert({
        type: 'collaborator_added',
        actor_id: req.user.id,
        job_id: jobId,
        metadata: { 
          target_user_id: userId, 
          role: role,
          notifications_sent: {
            slack: !!targetUser.slack_notifications,
            email: !!targetUser.email_notifications
          }
        },
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Error logging activity:', logError);
      // Don't fail the request for logging errors
    }

    res.json({ 
      success: true, 
      data: collaborator,
      notifications: {
        slack: !!targetUser.slack_notifications,
        email: !!targetUser.email_notifications
      }
    });

  } catch (error: any) {
    console.error('Error in add collaborator handler:', error);
    res.status(500).json({ error: error.message });
  }
};

export default handler;
