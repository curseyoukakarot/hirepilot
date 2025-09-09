import { Router } from 'express';
import { supabase as supabaseDb } from '../lib/supabase';

const router = Router();

// POST /api/auth/signup
// Creates a user with email_confirm=true and optional password
router.post('/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name, metadata } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const payload: any = {
      email,
      email_confirm: true,
      user_metadata: {
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        onboarding_complete: false,
        ...(metadata || {})
      }
    };
    if (password) payload.password = password;

    const { data: created, error } = await (supabaseDb as any).auth.admin.createUser(payload);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ user: created?.user });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});

export default router;


