import express, { Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';

console.log('✅ sendgridValidate router loaded');

const router = express.Router();

const validateSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
});

// POST /api/sendgrid/validate
router.post('/validate', async (req: Request, res: Response) => {
  console.log('📥 Handling /validate request');
  try {
    const { apiKey } = validateSchema.parse(req.body);
    console.log('🔑 Validating API key...');
    
    const sg = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    
    const { data } = await sg.get('/verified_senders');
    console.log('✅ API key validated successfully');
    const senders = data.results.map((s: any) => ({
      id: s.id,
      email: s.from_email || s.email || '',
      name: s.from_name || s.nickname || s.name || ''
    }));
    res.json({ senders });
  } catch (error: any) {
    const status = error?.response?.status || 400;
    const sgMsg = error?.response?.data?.errors?.[0]?.message || error?.response?.data?.message;
    const message =
      status === 401 ? 'Invalid SendGrid API key' :
      status === 403 ? 'SendGrid API key lacks required scopes' :
      sgMsg || (error?.message || 'Failed to validate SendGrid API key');

    console.error('❌ SendGrid validation error:', {
      status,
      data: error?.response?.data || null,
      message
    });

    res.status(status).json({ error: message });
  }
});

// 🔍 DEBUG — Print router stack
console.log('Router stack:', router.stack.map((layer: any) => ({
  path: layer.route?.path,
  methods: layer.route?.methods
})));

export default router; 