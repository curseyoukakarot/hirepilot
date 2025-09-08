// backend/api/createUser.ts

import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function createUser(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id, email, first_name, last_name, linkedin_url, company, plan } = req.body;

  if (!id || !email) {
    res.status(400).json({ error: 'Missing required fields: id or email' });
    return;
  }

  try {
    // Default free plan assignment if no paid plan provided or plan=free
    const assignedPlan = (plan === 'free' || !plan) ? 'free' : plan;
    const giveFreeCredits = assignedPlan === 'free' ? 50 : 0;

    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          id,
          email,
          first_name: first_name || null,
          last_name: last_name || null,
          linkedin_url: linkedin_url || null,
          company: company || null,
          plan: assignedPlan,
          monthly_credits: assignedPlan === 'free' ? 50 : null,
          remaining_credits: giveFreeCredits,
          plan_updated_at: new Date().toISOString(),
          onboarding_complete: false,
        }
      ]);

    if (error) {
      console.error('[createUser] Error inserting user:', error);
      res.status(500).json({ error: 'Failed to create user' });
      return;
    }

    res.status(200).json({ message: 'User created successfully', data });
    return;
  } catch (err) {
    console.error('[createUser] Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
}
