import express, { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Mock admin check middleware (TODO: replace with real auth check)
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.headers['x-admin']) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Bulk update endpoint
router.post('/bulk-update', async (req: Request, res: Response) => {
  const { payload } = req.body;
  if (!payload || !Array.isArray(payload)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  try {
    const { data, error } = await supabase.from('linkedin_accounts').upsert(payload);
    if (error) throw error;
    // Log admin action
    if (req.user) {
      await supabase.from('admin_actions').insert({
        action: 'bulk_update',
        details: JSON.stringify(payload),
        user_id: req.user.id
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('Bulk update error:', err);
    res.status(500).json({ error: 'Failed to apply bulk update' });
  }
});

// CSV upload endpoint
router.post('/csv-upload', async (req: Request, res: Response) => {
  const { csv } = req.body;
  if (!csv || !Array.isArray(csv)) {
    return res.status(400).json({ error: 'Invalid CSV data' });
  }
  try {
    const payload = csv.slice(1).map(row => ({
      email: row[0],
      liat: row[1],
      userAgent: row[2],
      resetCooldown: row[3] === 'true'
    }));
    const { data, error } = await supabase.from('linkedin_accounts').upsert(payload);
    if (error) throw error;
    // Log admin action
    if (req.user) {
      await supabase.from('admin_actions').insert({
        action: 'csv_upload',
        details: JSON.stringify(payload),
        user_id: req.user.id
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('CSV upload error:', err);
    res.status(500).json({ error: 'Failed to upload CSV' });
  }
});

// Extension sync endpoint
router.post('/extension-sync', async (req: Request, res: Response) => {
  try {
    // Fetch cookies and user agents from the extension
    const extensionData = await fetchExtensionData();
    if (!extensionData) {
      throw new Error('Failed to fetch data from extension');
    }
    // Update the linkedin_accounts table
    const { data, error } = await supabase.from('linkedin_accounts').upsert(extensionData);
    if (error) throw error;
    // Log admin action
    if (req.user) {
      await supabase.from('admin_actions').insert({
        action: 'extension_sync',
        details: JSON.stringify(extensionData),
        user_id: req.user.id
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('Extension sync error:', err);
    res.status(500).json({ error: 'Failed to sync with extension' });
  }
});

// Function to fetch data from the extension
async function fetchExtensionData() {
  // Real API call to the extension
  const response = await fetch(`${process.env.BACKEND_URL}/api/extension/data`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.EXTENSION_API_KEY}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch data from extension');
  }
  const data = await response.json();
  return data;
}

// POST /api/phantom/test-mode
router.post('/test-mode', requireAdmin, async (req, res) => {
  try {
    const { accountId, phantomType, inputMode, targetUrl, proxyOverride } = req.body;
    if (!accountId || !phantomType || !inputMode || !targetUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Fetch LinkedIn account
    const { data: account, error: accountError } = await supabase
      .from('linkedin_accounts')
      .select('*')
      .eq('id', accountId)
      .single();
    if (accountError || !account) {
      return res.status(404).json({ error: 'LinkedIn account not found' });
    }

    // 2. Fetch proxy (override or account's default)
    let proxy = null;
    if (proxyOverride) {
      const { data: proxyData, error: proxyError } = await supabase
        .from('phantombuster_proxies')
        .select('*')
        .eq('proxy_id', proxyOverride)
        .single();
      if (proxyError || !proxyData) {
        return res.status(404).json({ error: 'Proxy not found' });
      }
      proxy = proxyData;
    } else if (account.proxy_id) {
      const { data: proxyData, error: proxyError } = await supabase
        .from('phantombuster_proxies')
        .select('*')
        .eq('proxy_id', account.proxy_id)
        .single();
      if (!proxyError && proxyData) proxy = proxyData;
    }

    // 3. Prepare PhantomBuster arguments (single target, safe mode)
    const args = {
      sessionCookie: account.liat,
      userAgent: account.user_agent,
      queries: targetUrl, // Only a single URL allowed
      phantomType,
      inputMode,
      proxy: proxy ? {
        proxyType: proxy.proxy_type,
        proxyAddress: proxy.proxy_address,
        proxyUsername: proxy.proxy_username,
        proxyPassword: proxy.proxy_password,
        proxyLocation: proxy.proxy_location
      } : undefined,
      testMode: true // Custom flag for test mode
    };

    // TODO: Integrate with PhantomBuster API to launch the agent and wait for result
    // const pbResult = await launchPhantomBusterTest(args);
    // TODO: Parse pbResult for errors, logs, scraped data, etc.

    // MOCK OUTPUT for now
    const mockResult = {
      success: true,
      message: 'PhantomBuster test run complete (mock)',
      args,
      logs: ['[INFO] Test run started', '[INFO] Test run finished'],
      scraped: { name: 'Test User', title: 'Engineer', email: 'test@company.com' },
      errors: [],
      cookieAge: account.cookie_age || 1,
      proxyDetails: proxy || null
    };

    return res.json(mockResult);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[Test Mode Error]', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run PhantomBuster test mode' });
  }
});

export default router; 