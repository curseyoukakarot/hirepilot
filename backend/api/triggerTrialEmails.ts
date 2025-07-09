import { Request, Response } from 'express';
import { processTrialEmails } from '../workers/emailDrip';

export default async function triggerTrialEmails(req: Request, res: Response) {
  try {
    console.log('🚀 Manually triggering trial email processing...');
    
    await processTrialEmails();
    
    res.json({
      success: true,
      message: 'Trial email processing triggered successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Error triggering trial emails:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to trigger trial emails',
      details: error 
    });
  }
} 