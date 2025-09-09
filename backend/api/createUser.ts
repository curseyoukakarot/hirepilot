// backend/api/createUser.ts

import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

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
    // Minimal users row so Admin can see the user immediately
    // Use service-role client to bypass RLS on initial provisioning
    const { data, error } = await supabaseDb
      .from('users')
      .upsert({
        id,
        email,
        // Default sensible values; use explicit FREE role for free-tier users
        role: 'free'
      }, { onConflict: 'id' })
      .select('*')
      .single();

    // Best-effort: update optional profile/plan fields if these columns exist in schema
    // Do not fail signup if this update errors due to schema mismatch
    try {
      const assignedPlan = (plan === 'free' || !plan) ? 'free' : plan;
      const giveFreeCredits = assignedPlan === 'free' ? 50 : 0;
      await supabaseDb
        .from('users')
        .update({
          // Name fields may be camelCase or snake_case in some environments; we only update common fields safely
          // If your schema uses different casing, a separate migration/trigger will normalize
          firstName: first_name || undefined,
          lastName: last_name || undefined,
          onboardingComplete: false,
          plan: assignedPlan,
          monthly_credits: assignedPlan === 'free' ? 50 : null,
          remaining_credits: giveFreeCredits,
          plan_updated_at: new Date().toISOString(),
          linkedin_url: linkedin_url || undefined,
          company: company || undefined
        } as any)
        .eq('id', id);
      // Ensure a user_credits row exists with free allocation for free plan
      if (assignedPlan === 'free') {
        await supabaseDb
          .from('user_credits')
          .upsert({
            user_id: id,
            total_credits: 50,
            used_credits: 0,
            remaining_credits: 50,
            last_updated: new Date().toISOString()
          }, { onConflict: 'user_id' });
      }
    } catch (e) {
      console.warn('[createUser] Non-blocking users UPDATE failed (schema variance tolerated):', e);
    }

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
