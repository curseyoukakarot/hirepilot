import { ApiRequest, ApiHandler, ErrorResponse } from '../types/api';
import { Response } from 'express';
import { supabaseDb } from '../lib/supabase';

const handler: ApiHandler = async (req: ApiRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'Missing userId parameter' });
      return;
    }

    // Check if current user is super_admin
    const { data: currentUser, error: currentUserError } = await supabaseDb
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (currentUserError || !currentUser) {
      res.status(404).json({ error: 'Current user not found' });
      return;
    }

    if (currentUser.role !== 'super_admin') {
      res.status(403).json({ error: 'Insufficient permissions. Super admin access required.' });
      return;
    }

    // Fetch target user profile
    const { data: user, error: userError } = await supabaseDb
      .from('users')
      .select(`
        id, 
        email, 
        role, 
        credits_available, 
        credits_used, 
        team_id, 
        created_at,
        first_name,
        last_name,
        onboarding_complete
      `)
      .eq('id', userId)
      .single();

    if (userError) {
      res.status(404).json({ error: 'Target user not found' });
      return;
    }

    // Fetch user's team info if they have one
    let teamInfo = null;
    if (user.team_id) {
      const { data: team } = await supabaseDb
        .from('teams')
        .select('id, name, created_at')
        .eq('id', user.team_id)
        .single();
      teamInfo = team;
    }

    // Fetch recent candidates
    const { data: candidates } = await supabaseDb
      .from('candidates')
      .select(`
        id, 
        first_name, 
        last_name, 
        email, 
        status, 
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch recent leads
    const { data: leads } = await supabaseDb
      .from('leads')
      .select(`
        id, 
        first_name, 
        last_name, 
        email, 
        company_name, 
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch user's campaigns
    const { data: campaigns } = await supabaseDb
      .from('campaigns')
      .select(`
        id, 
        title, 
        status, 
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch user's subscription info
    const { data: subscription } = await supabaseDb
      .from('subscriptions')
      .select(`
        plan_tier, 
        seat_count, 
        included_seats, 
        status,
        created_at
      `)
      .eq('user_id', userId)
      .single();

    res.status(200).json({
      user,
      team: teamInfo,
      candidates: candidates || [],
      leads: leads || [],
      campaigns: campaigns || [],
      subscription: subscription || null
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch user data',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
};

export default handler;
