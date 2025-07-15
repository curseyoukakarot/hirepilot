import { sendEmail } from './emailService';
import { notifySlack } from '../lib/slack';
import { supabaseDb } from '../lib/supabase';

export async function sendApolloSearchNotifications(
  userId: string,
  campaignId: string,
  searchCriteria: {
    jobTitle?: string;
    keywords?: string;
    location?: string;
  },
  leadCount: number
) {
  try {
    // Get user and campaign details
    const { data: user, error: userError } = await supabaseDb
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[Apollo Notifications] User not found:', userId);
      return;
    }

    const { data: campaign, error: campaignError } = await supabaseDb
      .from('campaigns')
      .select('title, description')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[Apollo Notifications] Campaign not found:', campaignId);
      return;
    }

    const userEmail = user.email;
    const userName = user.first_name || 'there';
    const campaignTitle = campaign.title || 'Your Apollo campaign';

    // Build search criteria summary
    const searchSummary = [];
    if (searchCriteria.jobTitle) searchSummary.push(`Job Title: ${searchCriteria.jobTitle}`);
    if (searchCriteria.keywords) searchSummary.push(`Keywords: ${searchCriteria.keywords}`);
    if (searchCriteria.location) searchSummary.push(`Location: ${searchCriteria.location}`);
    
    const searchCriteriaText = searchSummary.length > 0 ? searchSummary.join(' • ') : 'No specific criteria';

    // Create email content
    const emailSubject = `🎯 Apollo Campaign Complete: ${leadCount} leads found instantly!`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4f46e5; margin: 0;">🎯 Apollo Campaign Complete!</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
        
        <p style="font-size: 16px; line-height: 1.5;">
          Great news! Your Apollo campaign <strong>"${campaignTitle}"</strong> has found 
          <strong style="color: #4f46e5;">${leadCount} qualified prospects</strong> and they're ready to review in HirePilot.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0; margin-bottom: 15px;">🔍 Search Criteria</h3>
          <div style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            ${searchCriteriaText}
          </div>
        </div>
        
        <div style="background-color: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #0369a1; margin-top: 0; margin-bottom: 10px;">📊 Campaign Summary</h3>
          <div style="color: #0369a1; font-size: 14px;">
            <strong>${leadCount}</strong> qualified prospects found and enriched<br>
            <strong>Ready to review:</strong> All leads are immediately available<br>
            <strong>Enrichment:</strong> Profile data populated from Apollo
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns/${campaignId}" 
             style="background-color: #4f46e5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Review Your ${leadCount} Leads
          </a>
        </div>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #374151; font-size: 14px;">
            <strong>💡 Next Steps:</strong> Your leads are ready for outreach! Use our message templates to start connecting with prospects or export them to your CRM.
          </p>
        </div>
        
        <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          This Apollo search was completed instantly with fully enriched profile data. 
          Happy recruiting!<br><br>
          The HirePilot Team
        </p>
      </div>
    `;

    // Send email notification
    if (userEmail) {
      await sendEmail(userEmail, emailSubject, `Apollo campaign "${campaignTitle}" found ${leadCount} leads instantly!`, emailHtml);
      console.log('[Apollo Notifications] Success email sent to:', userEmail);
    }

    // Send Slack notification
    const slackMessage = `🎯 *Apollo Campaign: ${campaignTitle}* completed!\n✅ Found ${leadCount} qualified prospects\n🔍 Search: ${searchCriteriaText}\n⚡ Results available immediately in HirePilot`;
    await notifySlack(slackMessage);
    console.log('[Apollo Notifications] Success Slack notification sent');

  } catch (error) {
    console.error('[Apollo Notifications] Error sending notifications:', error);
  }
}

export async function sendApolloEnrichmentNotifications(
  userId: string,
  campaignId: string,
  enrichedCount: number,
  totalCount: number
) {
  try {
    // Get user and campaign details
    const { data: user, error: userError } = await supabaseDb
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[Apollo Notifications] User not found:', userId);
      return;
    }

    const { data: campaign, error: campaignError } = await supabaseDb
      .from('campaigns')
      .select('title, description')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[Apollo Notifications] Campaign not found:', campaignId);
      return;
    }

    const userEmail = user.email;
    const userName = user.first_name || 'there';
    const campaignTitle = campaign.title || 'Your campaign';

    // Create email content
    const emailSubject = `⚡ Apollo Enrichment Complete: ${enrichedCount} leads enriched!`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #059669; margin: 0;">⚡ Enrichment Complete!</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
        
        <p style="font-size: 16px; line-height: 1.5;">
          Your campaign <strong>"${campaignTitle}"</strong> has completed Apollo enrichment! 
          <strong style="color: #059669;">${enrichedCount} out of ${totalCount} leads</strong> have been successfully enriched with additional profile data.
        </p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #15803d; margin-top: 0; margin-bottom: 15px;">📊 Enrichment Results</h3>
          <div style="color: #15803d; font-size: 14px;">
            <strong>Successfully enriched:</strong> ${enrichedCount} leads<br>
            <strong>Total leads:</strong> ${totalCount}<br>
            <strong>Success rate:</strong> ${Math.round((enrichedCount / totalCount) * 100)}%
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns/${campaignId}" 
             style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Review Enriched Leads
          </a>
        </div>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #374151; font-size: 14px;">
            <strong>💡 What's New:</strong> Enriched leads now have additional contact information, job details, and company insights from Apollo's database.
          </p>
        </div>
        
        <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          Your leads are now ready for more targeted outreach with enriched data.<br><br>
          The HirePilot Team
        </p>
      </div>
    `;

    // Send email notification
    if (userEmail) {
      await sendEmail(userEmail, emailSubject, `Campaign "${campaignTitle}" enrichment complete: ${enrichedCount} leads enriched!`, emailHtml);
      console.log('[Apollo Notifications] Enrichment email sent to:', userEmail);
    }

    // Send Slack notification
    const slackMessage = `⚡ *Apollo Enrichment: ${campaignTitle}* completed!\n✅ Enriched ${enrichedCount} out of ${totalCount} leads\n📊 Success rate: ${Math.round((enrichedCount / totalCount) * 100)}%\n👉 Ready for outreach`;
    await notifySlack(slackMessage);
    console.log('[Apollo Notifications] Enrichment Slack notification sent');

  } catch (error) {
    console.error('[Apollo Notifications] Error sending enrichment notifications:', error);
  }
}

export async function sendApolloErrorNotifications(
  userId: string,
  campaignId: string,
  errorMessage: string,
  searchCriteria?: {
    jobTitle?: string;
    keywords?: string;
    location?: string;
  }
) {
  try {
    // Get user and campaign details
    const { data: user, error: userError } = await supabaseDb
      .from('users')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[Apollo Notifications] User not found:', userId);
      return;
    }

    const { data: campaign, error: campaignError } = await supabaseDb
      .from('campaigns')
      .select('title, description')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[Apollo Notifications] Campaign not found:', campaignId);
      return;
    }

    const userEmail = user.email;
    const userName = user.first_name || 'there';
    const campaignTitle = campaign.title || 'Your Apollo campaign';

    // Build search criteria summary if provided
    let searchSummary = '';
    if (searchCriteria) {
      const searchParts = [];
      if (searchCriteria.jobTitle) searchParts.push(`Job Title: ${searchCriteria.jobTitle}`);
      if (searchCriteria.keywords) searchParts.push(`Keywords: ${searchCriteria.keywords}`);
      if (searchCriteria.location) searchParts.push(`Location: ${searchCriteria.location}`);
      searchSummary = searchParts.length > 0 ? searchParts.join(' • ') : '';
    }

    // Create email content
    const emailSubject = `❌ Apollo Campaign Error: "${campaignTitle}"`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc2626; margin: 0;">❌ Apollo Campaign Error</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
        
        <p style="font-size: 16px; line-height: 1.5;">
          Unfortunately, your Apollo campaign <strong>"${campaignTitle}"</strong> encountered an error and couldn't complete successfully.
        </p>
        
        ${searchSummary ? `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0; margin-bottom: 15px;">🔍 Search Criteria</h3>
          <div style="color: #6b7280; font-size: 14px;">
            ${searchSummary}
          </div>
        </div>
        ` : ''}
        
        <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #b91c1c; margin-top: 0; margin-bottom: 15px;">Error Details</h3>
          <div style="color: #b91c1c; font-size: 14px; font-family: monospace; background-color: #fee2e2; padding: 10px; border-radius: 4px;">
            ${errorMessage}
          </div>
        </div>
        
        <div style="background-color: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #0369a1; margin-top: 0; margin-bottom: 15px;">🔧 Common Solutions</h3>
          <div style="color: #0369a1; font-size: 14px;">
            <strong>Apollo API Issues:</strong><br>
            • Check if your Apollo API key is valid and active<br>
            • Verify you have sufficient Apollo credits<br>
            • Try broadening your search criteria<br><br>
            <strong>Search Criteria:</strong><br>
            • Use more general job titles<br>
            • Try different location formats<br>
            • Reduce the number of keywords
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns/${campaignId}" 
             style="background-color: #4f46e5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Try Again
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          If this issue persists, please contact our support team with the error details above.<br><br>
          The HirePilot Team
        </p>
      </div>
    `;

    // Send email notification
    if (userEmail) {
      await sendEmail(userEmail, emailSubject, `Apollo campaign "${campaignTitle}" failed: ${errorMessage}`, emailHtml);
      console.log('[Apollo Notifications] Error email sent to:', userEmail);
    }

    // Send Slack notification
    const slackMessage = `❌ *Apollo Campaign: ${campaignTitle}* failed\n🔧 Error: ${errorMessage}\n${searchSummary ? `🔍 Search: ${searchSummary}\n` : ''}💡 Check API key and search criteria`;
    await notifySlack(slackMessage);
    console.log('[Apollo Notifications] Error Slack notification sent');

  } catch (error) {
    console.error('[Apollo Notifications] Error sending error notifications:', error);
  }
} 