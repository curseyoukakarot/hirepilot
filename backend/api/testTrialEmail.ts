import { Request, Response } from 'express';
import { sendTemplateEmail } from '../lib/emailDrip';

export default async function testTrialEmail(req: Request, res: Response) {
  try {
    const { userId, templateType, email } = req.body;
    
    if (!userId || !templateType) {
      res.status(400).json({ error: 'Missing userId or templateType' });
      return;
    }

    const TEMPLATES = {
      welcome: process.env.SENDGRID_TEMPLATE_WELCOME!,
      powerup: process.env.SENDGRID_TEMPLATE_POWERUP!,
      expiry: process.env.SENDGRID_TEMPLATE_EXPIRY!
    };

    const templateId = TEMPLATES[templateType as keyof typeof TEMPLATES];
    
    if (!templateId) {
      res.status(400).json({ 
        error: 'Invalid template type', 
        availableTypes: Object.keys(TEMPLATES) 
      });
      return;
    }

    console.log(`🧪 Testing trial email send:`, {
      userId,
      templateType,
      templateId,
      targetEmail: email
    });

    // Test the actual email sending
    await sendTemplateEmail(userId, templateId);

    res.json({
      success: true,
      message: `${templateType} email sent successfully`,
      details: {
        userId,
        templateType,
        templateId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Test trial email error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to send test email',
      details: error,
      stack: error.stack
    });
  }
} 