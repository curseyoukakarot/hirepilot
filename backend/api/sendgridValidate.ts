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
    res.json({ senders: data.results });
  } catch (error: any) {
    console.error('❌ SendGrid validation error:', error.response?.data ?? error);
    res.status(400).json({ error: error.message || 'Failed to validate SendGrid API key' });
  }
});

// 🔍 DEBUG — Print router stack
console.log('Router stack:', router.stack.map((layer: any) => ({
  path: layer.route?.path,
  methods: layer.route?.methods
})));

export default router; 