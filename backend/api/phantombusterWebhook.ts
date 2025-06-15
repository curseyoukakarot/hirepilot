import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSchema = z.object({
  job_id: z.string().min(1, 'Job ID is required'),
  user_id: z.string().min(1, 'User ID is required'),
  leads: z.array(z.object({}).passthrough()), // Adjust as needed
});

// POST /api/phantombuster/webhook
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { job_id, user_id, leads } = webhookSchema.parse(req.body);
    // Insert leads into Supabase
    const { error } = await supabase
      .from('leads')
      .insert(leads.map((lead: any) => ({ ...lead, user_id })));
    if (error) throw error;
    // Trigger Apollo enrichment for leads without an email
    const leadsWithoutEmail = leads.filter((lead: any) => !lead.email);
    if (leadsWithoutEmail.length > 0) {
      // This is a placeholder; implement your Apollo enrichment logic here
      // For example, call Apollo's API to enrich each lead
      for (const lead of leadsWithoutEmail) {
        await axios.post('https://api.apollo.io/v1/people/match', {
          api_key: process.env.APOLLO_API_KEY,
          // Add necessary parameters for Apollo enrichment
        });
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('PhantomBuster webhook error:', error);
    res.status(400).json({ error: error.message || 'Failed to process webhook' });
  }
});

export default router; 