import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

console.log('✅ sendgridSave router loaded');

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const router = Router();

const bodySchema = z.object({
  user_id:        z.string().uuid(),
  api_key:        z.string().min(1),
  default_sender: z.string().email()
});

router.post('/save', async (req, res) => {
  console.log('📥 Handling /save request');
  console.log('Request body:', req.body);  // Debug the raw body
  
  try {
    // Validate required fields manually for better error messages
    if (!req.body.user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }
    if (!req.body.api_key) {
      res.status(400).json({ error: 'api_key is required' });
      return;
    }
    if (!req.body.default_sender) {
      res.status(400).json({ error: 'default_sender is required' });
      return;
    }

    const { user_id, api_key, default_sender } = bodySchema.parse(req.body);
    console.log('💾 Saving SendGrid integration for user:', user_id);

    // Save to user_sendgrid_keys table
    const { error } = await supabase
      .from('user_sendgrid_keys')
      .upsert({
        user_id,
        api_key,
        default_sender,
        connected_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('❌ Supabase error (user_sendgrid_keys):', error);
      throw error;
    }

    // Also persist unified integration status so frontend settings can reflect connection state
    try {
      const { error: integrationError } = await supabase
        .from('integrations')
        .upsert(
          {
            user_id,
            provider: 'sendgrid',
            status: 'connected',
            connected_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider' }
        );

      if (integrationError) {
        console.error('⚠️ Failed to upsert sendgrid row into integrations table:', integrationError);
      } else {
        console.log('✅ SendGrid integration status recorded in integrations table');
      }
    } catch (integrationErr) {
      console.error('⚠️ Unexpected error while updating integrations table for sendgrid:', integrationErr);
      // Do not fail the main request if the auxiliary status write fails
    }

    console.log('✅ SendGrid integration saved successfully (API key + status)');
    res.sendStatus(204);
  } catch (err: any) {
    console.error('❌ sendgrid/save error:', err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ 
        error: 'Invalid input',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }
    res.status(400).json({ error: err.message || 'save failed' });
    return;
  }
});

// 🔍 DEBUG — Print router stack
console.log('Router stack:', router.stack.map((layer: any) => ({
  path: layer.route?.path,
  methods: layer.route?.methods
})));

export default router; 