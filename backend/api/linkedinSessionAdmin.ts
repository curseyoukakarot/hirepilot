/**
 * Admin API for LinkedIn session management
 * - GET /api/admin/linkedin-accounts
 * - POST /api/admin/update-session
 * - POST /api/admin/refresh-session-extension
 */
const express = require('express');
const router = express.Router();
const { supabase } = require('../src/lib/supabase');

// Mock admin check middleware
function requireAdmin(req: any, res: any, next: any) {
  // TODO: Replace with real auth check
  if (!req.headers['x-admin']) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/** @type {import('express').RequestHandler} */
// GET /api/admin/linkedin-accounts
router.get('/linkedin-accounts', requireAdmin, async (req: any, res: any) => {
  // Query the new linkedin_accounts table
  const { data: accounts, error } = await supabase.from('linkedin_accounts').select('*');
  if (error) return res.status(500).json({ error: error.message });
  // Mask li_at cookie
  const result = (accounts || []).map((acc: any) => ({
    id: acc.id,
    email: acc.email,
    lastUpdated: acc.last_updated_at,
    proxy: acc.proxy,
    cooldown: acc.is_in_cooldown,
    liatMasked: acc.liat ? acc.liat.slice(0, 4) + '****' : '',
    userAgent: acc.user_agent ? acc.user_agent.slice(0, 10) + '...' : '',
  }));
  res.json(result);
});

/** @type {import('express').RequestHandler} */
// POST /api/admin/update-session
router.post('/update-session', requireAdmin, async (req: any, res: any) => {
  const { accountId, liat, userAgent, sourceBrowser, updatedBy, resetCooldown } = req.body;
  if (!accountId || !liat || !userAgent || !updatedBy) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // TODO: Encrypt liat and userAgent in production
  const updates: any = {
    liat,
    user_agent: userAgent,
    source_browser: sourceBrowser,
    updated_by: updatedBy,
    last_updated_at: new Date().toISOString(),
  };
  if (resetCooldown) {
    updates.is_in_cooldown = false;
  }
  const { error } = await supabase.from('linkedin_accounts').update(updates).eq('id', accountId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: 'Session updated' });
});

/** @type {import('express').RequestHandler} */
// POST /api/admin/refresh-session-extension
router.post('/refresh-session-extension', requireAdmin, async (req: any, res: any) => {
  const { accountId } = req.body;
  if (!accountId) {
    return res.status(400).json({ error: 'Missing accountId' });
  }
  // TODO: Fetch latest session from PhantomBuster API and update linkedin_accounts
  // Mock response
  res.json({ success: true, message: 'Session refreshed via extension (mock)' });
});

module.exports = router; 