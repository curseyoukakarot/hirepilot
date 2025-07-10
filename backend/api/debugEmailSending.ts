import { Request, Response } from 'express';
import { supabaseDb } from '../lib/supabase';
import sgMail from '@sendgrid/mail';

export default async function debugEmailSending(req: Request, res: Response) {
  try {
    const { userId, email } = req.query;
    
    const debugInfo: any = {
      step1_environment: {
        SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY ? 'EXISTS' : 'MISSING',
        SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'MISSING',
        SENDGRID_TEMPLATE_WELCOME: process.env.SENDGRID_TEMPLATE_WELCOME || 'MISSING',
        api_key_length: process.env.SENDGRID_API_KEY?.length || 0
      },
      step2_user_lookup: null,
      step3_sendgrid_setup: null,
      step4_email_attempt: null
    };

    // Step 2: User lookup
    let targetUserId = userId;
    if (email && !userId) {
      const { data: user, error: userError } = await supabaseDb
        .from('users')
        .select('id, email, firstName, email_notifications')
        .eq('email', email as string)
        .single();
      
      debugInfo.step2_user_lookup = {
        success: !userError && !!user,
        error: userError,
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          email_notifications: user.email_notifications
        } : null
      };
      
      if (user) targetUserId = user.id;
    } else if (userId) {
      const { data: user, error: userError } = await supabaseDb
        .from('users')
        .select('id, email, firstName, email_notifications')
        .eq('id', userId as string)
        .single();
      
      debugInfo.step2_user_lookup = {
        success: !userError && !!user,
        error: userError,
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          email_notifications: user.email_notifications
        } : null
      };
    }

    // Step 3: SendGrid setup test
    if (process.env.SENDGRID_API_KEY) {
      try {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        debugInfo.step3_sendgrid_setup = {
          success: true,
          api_key_configured: true
        };
      } catch (setupError) {
        debugInfo.step3_sendgrid_setup = {
          success: false,
          error: setupError.message
        };
      }
    } else {
      debugInfo.step3_sendgrid_setup = {
        success: false,
        error: 'SENDGRID_API_KEY not found in environment'
      };
    }

    // Step 4: Attempt to send a test email (if we have a valid user and setup)
    if (debugInfo.step2_user_lookup?.success && debugInfo.step3_sendgrid_setup?.success) {
      try {
        const user = debugInfo.step2_user_lookup.user;
        const testMsg = {
          to: user.email,
          from: process.env.SENDGRID_FROM_EMAIL!,
          templateId: process.env.SENDGRID_TEMPLATE_WELCOME!,
          dynamic_template_data: {
            first_name: user.firstName || '',
            frontend_url: process.env.FRONTEND_URL
          }
        };

        console.log('🧪 Attempting SendGrid send with message:', testMsg);
        
        const result = await sgMail.send(testMsg);
        
        debugInfo.step4_email_attempt = {
          success: true,
          sendgrid_response: result[0] ? {
            statusCode: result[0].statusCode,
            headers: result[0].headers,
            body: result[0].body
          } : 'No response data',
          message_details: testMsg
        };
        
      } catch (sendError: any) {
        debugInfo.step4_email_attempt = {
          success: false,
          error: sendError.message,
          error_code: sendError.code,
          response: sendError.response?.body || 'No response body',
          stack: sendError.stack
        };
      }
    }

    res.json({
      success: true,
      debug_info: debugInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Debug email sending error:', error);
    res.status(500).json({ 
      error: error.message || 'Debug failed',
      details: error 
    });
  }
} 