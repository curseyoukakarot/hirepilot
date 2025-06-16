import express from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/phantombuster/run
router.post('/run', async (req, res) => {
  const { user_id, campaign_id, search_url, job_title, location } = req.body;
  if (!user_id || !campaign_id || !search_url) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // 1. Get user's PhantomBuster API key and LinkedIn session cookie
    const { data: pbAccount, error: pbError } = await supabase
      .from('phantombuster_accounts')
      .select('api_key, session_cookie')
      .eq('user_id', user_id)
      .single();
    if (pbError || !pbAccount?.session_cookie) {
      res.status(400).json({ error: 'No LinkedIn session cookie found. Please connect on the Integrations page.' });
      return;
    }
    // Use user's API key if present, else use HirePilot's
    const apiKey = pbAccount.api_key || process.env.PHANTOMBUSTER_API_KEY;
    if (!apiKey) {
      res.status(400).json({ error: 'No PhantomBuster API key available.' });
      return;
    }

    // 2. Launch the LinkedIn Search Phantom
    // (Replace with your actual PhantomBuster agent/agentId)
    const agentId = process.env.PHANTOMBUSTER_LINKEDIN_AGENT_ID;
    if (!agentId) {
      res.status(500).json({ error: 'PhantomBuster agent ID not configured.' });
      return;
    }
    const webhookUrl = `${process.env.BACKEND_URL}/api/phantombuster/webhook`;
    const launchRes = await axios.post(
      `https://api.phantombuster.com/api/v2/agents/launch`,
      {
        id: agentId,
        argument: {
          sessionCookie: pbAccount.session_cookie,
          searchUrl: search_url,
          jobTitle: job_title,
          location: location,
          campaignId: campaign_id,
          userId: user_id
        },
        saveArgument: true,
        webhook: webhookUrl
      },
      {
        headers: { 'X-Phantombuster-API-Key': apiKey }
      }
    );
    res.json({ success: true, run_id: launchRes.data?.containerId || null });
  } catch (err: any) {
    console.error('PhantomBuster run error:', err.response?.data || err);
    res.status(500).json({ error: 'Failed to launch PhantomBuster agent.' });
  }
});

// GET /api/phantombuster/status/:executionId
router.get('/status/:executionId', async (req, res) => {
  const { executionId } = req.params;
  if (!executionId) {
    res.status(400).json({ error: 'Missing execution ID' });
    return;
  }

  try {
    // Get the execution details from Supabase
    const { data: execution, error: executionError } = await supabase
      .from('campaign_executions')
      .select('*')
      .eq('phantombuster_execution_id', executionId)
      .single();

    if (executionError) {
      throw executionError;
    }

    if (!execution) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    // If the execution is already completed or failed, return its status
    if (execution.status === 'completed' || execution.status === 'failed') {
      return res.json({ status: execution.status, error: execution.error });
    }

    // Otherwise, check with PhantomBuster API
    const apiKey = process.env.PHANTOMBUSTER_API_KEY;
    const response = await axios.get(
      `https://api.phantombuster.com/api/v2/containers/fetch-output`,
      {
        params: { id: executionId },
        headers: { 'X-Phantombuster-Key': apiKey }
      }
    );

    const status = response.data?.status || 'unknown';
    const error = response.data?.error || null;

    // Update the execution status in Supabase
    await supabase
      .from('campaign_executions')
      .update({ 
        status,
        error,
        updated_at: new Date().toISOString()
      })
      .eq('phantombuster_execution_id', executionId);

    res.json({ status, error });
  } catch (err: any) {
    console.error('Error checking PhantomBuster status:', err);
    res.status(500).json({ 
      error: 'Failed to check PhantomBuster status',
      details: err.message 
    });
  }
});

export default router; 