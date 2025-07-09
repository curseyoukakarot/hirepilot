import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';

export default async function debugTrialEmails(req: Request, res: Response) {
  try {
    const { userId, email } = req.query;
    
    console.log('🔍 Debugging trial emails for:', { userId, email });
    
    // 1. Check if user exists
    let userQuery = supabaseDb.from('users').select('*');
    if (userId) {
      userQuery = userQuery.eq('id', userId as string);
    } else if (email) {
      userQuery = userQuery.eq('email', email as string);
    } else {
      res.status(400).json({ error: 'Provide either userId or email parameter' });
      return;
    }
    
    const { data: user, error: userError } = await userQuery.single();
    
    if (userError || !user) {
      res.json({ 
        error: 'User not found',
        details: userError,
        searched: { userId, email }
      });
      return;
    }
    
    // 2. Check trial_emails record
    const { data: trialEmail, error: trialError } = await supabaseDb
      .from('trial_emails')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    // 3. Test the RPC function
    const { data: rpcResults, error: rpcError } = await supabaseDb.rpc('get_trial_email_status');
    
    // 4. Check environment variables
    const envCheck = {
      SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
      SENDGRID_FROM_EMAIL: !!process.env.SENDGRID_FROM_EMAIL,
      SENDGRID_TEMPLATE_WELCOME: !!process.env.SENDGRID_TEMPLATE_WELCOME,
      SENDGRID_TEMPLATE_POWERUP: !!process.env.SENDGRID_TEMPLATE_POWERUP,
      SENDGRID_TEMPLATE_EXPIRY: !!process.env.SENDGRID_TEMPLATE_EXPIRY,
      templates: {
        welcome: process.env.SENDGRID_TEMPLATE_WELCOME,
        powerup: process.env.SENDGRID_TEMPLATE_POWERUP,
        expiry: process.env.SENDGRID_TEMPLATE_EXPIRY
      }
    };
    
    // 5. Calculate days since signup
    let daysSinceSignup = null;
    if (trialEmail?.created_at) {
      const today = new Date();
      const createdAt = new Date(trialEmail.created_at);
      daysSinceSignup = Math.floor((today.getTime() - createdAt.getTime()) / 86400000);
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_notifications: user.email_notifications,
        created_at: user.created_at
      },
      trial_email_record: trialEmail ? {
        ...trialEmail,
        days_since_signup: daysSinceSignup
      } : null,
      trial_email_error: trialError,
      rpc_function: {
        working: !rpcError,
        error: rpcError,
        results_count: rpcResults?.length || 0,
        user_included: rpcResults?.some((row: any) => row.user_id === user.id) || false
      },
      environment: envCheck,
      next_actions: {
        should_send_welcome: !trialEmail?.welcome_sent,
        should_send_powerup: daysSinceSignup >= 1 && !trialEmail?.powerup_sent,
        should_send_expiry: daysSinceSignup >= 6 && !trialEmail?.expiry_sent,
        days_since_signup: daysSinceSignup
      }
    });
    
  } catch (error: any) {
    console.error('❌ Debug trial emails error:', error);
    res.status(500).json({ 
      error: error.message || 'Debug failed',
      details: error 
    });
  }
} 