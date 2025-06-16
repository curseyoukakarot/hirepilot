// backend/api/createUser.ts

import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function createUser(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id, email } = req.body;

  if (!id || !email) {
    res.status(400).json({ error: 'Missing required fields: id or email' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          id,        // 🧠 This should match the Supabase Auth ID
          email,     // 🧠 This saves the user's email
          onboarding_complete: false
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
