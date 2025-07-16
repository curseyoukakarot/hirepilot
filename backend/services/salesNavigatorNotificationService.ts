import { sendEmail } from './emailService';
import { notifySlack } from '../lib/slack';
import { supabaseDb } from '../lib/supabase';

interface SalesNavigatorSearchCriteria {
  searchUrl?: string;
  keywords?: string[];
  location?: string;
  company?: string;
  title?: string;
}

export async function sendSalesNavigatorSuccessNotifications(
  userId: string,
  campaignId: string,
  searchCriteria: SalesNavigatorSearchCriteria,
  leadCount: number
) {
  try {
    console.log('[Sales Navigator Notifications] sendSalesNavigatorSuccessNotifications called with:', {
      userId,
      campaignId,
      searchCriteria,
      leadCount
    });
    
    // Get user and campaign details
    const { data: user, error: userError } = await supabaseDb
      .from('users')
      .select('email, firstName, lastName, email_notifications, slack_notifications')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[Sales Navigator Notifications] User not found:', userId);
      return;
    }

    const { data: campaign, error: campaignError } = await supabaseDb
      .from('campaigns')
      .select('title, description, lead_source_payload')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[Sales Navigator Notifications] Campaign not found:', campaignId);
      return;
    }

    const userEmail = user.email;
    const userName = user.firstName || 'there';
    const campaignTitle = campaign.title || 'Your Sales Navigator campaign';

    // Extract search parameters from URL or payload
    const searchUrl = searchCriteria.searchUrl || campaign.lead_source_payload?.linkedin_search_url || '';
    const urlParams = new URLSearchParams(searchUrl.split('?')[1] || '');
    
    // Build search criteria summary
    const searchSummary = [];
    
    // Extract common LinkedIn Sales Navigator parameters
    const keywords = urlParams.get('keywords') || searchCriteria.keywords?.join(', ');
    const location = urlParams.get('geoUrn') || searchCriteria.location;
    const company = urlParams.get('company') || searchCriteria.company;
    const title = urlParams.get('title') || searchCriteria.title;
    
    if (keywords) searchSummary.push(`Keywords: ${keywords}`);
    if (title) searchSummary.push(`Job Title: ${title}`);
    if (company) searchSummary.push(`Company: ${company}`);
    if (location) searchSummary.push(`Location: ${location}`);
    
    const searchCriteriaText = searchSummary.length > 0 ? searchSummary.join(' • ') : 'Custom LinkedIn Sales Navigator search';

    // Create email content (if user has email notifications enabled)
    if (user.email_notifications !== false && userEmail) {
      const emailSubject = `🎯 Sales Navigator Campaign Complete: ${leadCount} leads found!`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0077b5; margin: 0;">🎯 Sales Navigator Campaign Complete!</h1>
          </div>
          
          <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
          
          <p style="font-size: 16px; line-height: 1.5;">
            Excellent news! Your Sales Navigator campaign <strong>"${campaignTitle}"</strong> has successfully found 
            <strong style="color: #0077b5;">${leadCount} qualified prospects</strong> and they're ready to review in HirePilot.
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
              <strong>${leadCount}</strong> qualified prospects found from LinkedIn Sales Navigator<br>
              <strong>Processing time:</strong> ~10 minutes (automated scraping completed)<br>
              <strong>Data quality:</strong> LinkedIn verified profiles with current company info
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns/${campaignId}" 
               style="background-color: #0077b5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Review Your ${leadCount} Prospects
            </a>
          </div>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #0077b5; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #374151; font-size: 14px;">
              <strong>💡 Next Steps:</strong> Your leads are ready for enrichment and outreach! You can now enrich them with contact details using Apollo, or manually add contact information using the edit buttons in each lead profile.
            </p>
          </div>
          
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h4 style="color: #b91c1c; margin-top: 0; margin-bottom: 10px;">📋 Remember</h4>
            <div style="color: #b91c1c; font-size: 13px;">
              <strong>Credits Used:</strong> 50 credits for this LinkedIn campaign<br>
              <strong>Phone Numbers:</strong> Connect your own Apollo account via Zapier for phone enrichment<br>
              <strong>Data Quality:</strong> All leads are current LinkedIn profiles from your search
            </div>
          </div>
          
          <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            Your Sales Navigator search processed successfully in the background. 
            Happy recruiting!<br><br>
            The HirePilot Team
          </p>
        </div>
      `;

      await sendEmail(userEmail, emailSubject, `Sales Navigator campaign "${campaignTitle}" found ${leadCount} leads!`, emailHtml);
      console.log('[Sales Navigator Notifications] Success email sent to:', userEmail);
    }

    // Send Slack notification (if user has Slack notifications enabled)
    if (user.slack_notifications !== false) {
      const slackMessage = `🎯 *Sales Navigator Campaign: ${campaignTitle}* completed!\n✅ Found ${leadCount} qualified prospects from LinkedIn\n🔍 Search: ${searchCriteriaText}\n⚡ Ready for enrichment and outreach in HirePilot\n💳 50 credits used for LinkedIn scraping`;
      await notifySlack(slackMessage);
      console.log('[Sales Navigator Notifications] Success Slack notification sent');
    }

  } catch (error) {
    console.error('[Sales Navigator Notifications] Error sending notifications:', error);
  }
}

export async function sendSalesNavigatorStartNotifications(
  userId: string,
  campaignId: string,
  searchCriteria: SalesNavigatorSearchCriteria
) {
  try {
    console.log('[Sales Navigator Notifications] sendSalesNavigatorStartNotifications called with:', {
      userId,
      campaignId,
      searchCriteria
    });
    
    // Get user and campaign details
    const { data: user, error: userError } = await supabaseDb
      .from('users')
      .select('email, firstName, lastName, email_notifications, slack_notifications')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[Sales Navigator Notifications] User not found:', userId);
      return;
    }

    const { data: campaign, error: campaignError } = await supabaseDb
      .from('campaigns')
      .select('title, description')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[Sales Navigator Notifications] Campaign not found:', campaignId);
      return;
    }

    const userEmail = user.email;
    const userName = user.firstName || 'there';
    const campaignTitle = campaign.title || 'Your Sales Navigator campaign';

    // Send Slack notification about campaign start (if enabled)
    if (user.slack_notifications !== false) {
      const slackMessage = `🚀 *Sales Navigator Campaign: ${campaignTitle}* started!\n⏰ Expected completion: ~10 minutes\n🔍 LinkedIn scraping in progress...\n📧 You'll receive an email when leads are ready`;
      await notifySlack(slackMessage);
      console.log('[Sales Navigator Notifications] Start Slack notification sent');
    }

  } catch (error) {
    console.error('[Sales Navigator Notifications] Error sending start notifications:', error);
  }
}

export async function sendSalesNavigatorNoResultsNotifications(
  userId: string,
  campaignId: string,
  searchCriteria: SalesNavigatorSearchCriteria
) {
  try {
    // Get user and campaign details
    const { data: user, error: userError } = await supabaseDb
      .from('users')
      .select('email, firstName, lastName, email_notifications, slack_notifications')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[Sales Navigator Notifications] User not found:', userId);
      return;
    }

    const { data: campaign, error: campaignError } = await supabaseDb
      .from('campaigns')
      .select('title, description')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[Sales Navigator Notifications] Campaign not found:', campaignId);
      return;
    }

    const userEmail = user.email;
    const userName = user.firstName || 'there';
    const campaignTitle = campaign.title || 'Your Sales Navigator campaign';

    // Build search criteria summary
    const searchUrl = searchCriteria.searchUrl || '';
    const urlParams = new URLSearchParams(searchUrl.split('?')[1] || '');
    
    const searchSummary = [];
    const keywords = urlParams.get('keywords') || searchCriteria.keywords?.join(', ');
    const location = urlParams.get('geoUrn') || searchCriteria.location;
    const company = urlParams.get('company') || searchCriteria.company;
    const title = urlParams.get('title') || searchCriteria.title;
    
    if (keywords) searchSummary.push(`Keywords: ${keywords}`);
    if (title) searchSummary.push(`Job Title: ${title}`);
    if (company) searchSummary.push(`Company: ${company}`);
    if (location) searchSummary.push(`Location: ${location}`);
    
    const searchCriteriaText = searchSummary.length > 0 ? searchSummary.join(' • ') : 'Custom LinkedIn Sales Navigator search';

    // Create email content (if user has email notifications enabled)
    if (user.email_notifications !== false && userEmail) {
      const emailSubject = `⚠️ Sales Navigator Campaign Complete - No leads found`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f59e0b; margin: 0;">⚠️ Campaign Complete</h1>
          </div>
          
          <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
          
          <p style="font-size: 16px; line-height: 1.5;">
            Your Sales Navigator campaign <strong>"${campaignTitle}"</strong> has completed successfully, but unfortunately no leads were found that match your search criteria.
          </p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0; margin-bottom: 15px;">🔍 Search Criteria Used</h3>
            <div style="color: #6b7280; font-size: 14px;">
              ${searchCriteriaText}
            </div>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0; margin-bottom: 15px;">💡 Tips to improve results:</h3>
            <ul style="color: #856404; margin-bottom: 0; padding-left: 20px;">
              <li>Try broadening your search criteria (fewer keywords)</li>
              <li>Expand the geographic location</li>
              <li>Use more general job titles</li>
              <li>Check if your LinkedIn Sales Navigator search URL works manually</li>
              <li>Ensure your LinkedIn session is still active</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns/new" 
               style="background-color: #0077b5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Create New Campaign
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            Don't worry - no credits were charged since no leads were found. Try adjusting your search criteria and running again.<br><br>
            The HirePilot Team
          </p>
        </div>
      `;

      await sendEmail(userEmail, emailSubject, `Sales Navigator campaign "${campaignTitle}" completed with no results`, emailHtml);
      console.log('[Sales Navigator Notifications] No results email sent to:', userEmail);
    }

    // Send Slack notification (if enabled)
    if (user.slack_notifications !== false) {
      const slackMessage = `⚠️ *Sales Navigator Campaign: ${campaignTitle}* completed with no results\n🔍 Search: ${searchCriteriaText}\n💡 Try broadening your search criteria\n💳 No credits charged (no leads found)`;
      await notifySlack(slackMessage);
      console.log('[Sales Navigator Notifications] No results Slack notification sent');
    }

  } catch (error) {
    console.error('[Sales Navigator Notifications] Error sending no results notifications:', error);
  }
}

export async function sendSalesNavigatorErrorNotifications(
  userId: string,
  campaignId: string,
  errorMessage: string,
  searchCriteria?: SalesNavigatorSearchCriteria
) {
  try {
    // Get user and campaign details
    const { data: user, error: userError } = await supabaseDb
      .from('users')
      .select('email, firstName, lastName, email_notifications, slack_notifications')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[Sales Navigator Notifications] User not found:', userId);
      return;
    }

    const { data: campaign, error: campaignError } = await supabaseDb
      .from('campaigns')
      .select('title, description')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('[Sales Navigator Notifications] Campaign not found:', campaignId);
      return;
    }

    const userEmail = user.email;
    const userName = user.firstName || 'there';
    const campaignTitle = campaign.title || 'Your Sales Navigator campaign';

    // Build search criteria summary if provided
    let searchSummary = '';
    if (searchCriteria) {
      const searchParts = [];
      const keywords = searchCriteria.keywords?.join(', ');
      if (keywords) searchParts.push(`Keywords: ${keywords}`);
      if (searchCriteria.title) searchParts.push(`Job Title: ${searchCriteria.title}`);
      if (searchCriteria.company) searchParts.push(`Company: ${searchCriteria.company}`);
      if (searchCriteria.location) searchParts.push(`Location: ${searchCriteria.location}`);
      searchSummary = searchParts.length > 0 ? searchParts.join(' • ') : '';
    }

    // Create email content (if user has email notifications enabled)
    if (user.email_notifications !== false && userEmail) {
      const emailSubject = `❌ Sales Navigator Campaign Error: "${campaignTitle}"`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #dc2626; margin: 0;">❌ Sales Navigator Campaign Error</h1>
          </div>
          
          <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
          
          <p style="font-size: 16px; line-height: 1.5;">
            Unfortunately, your Sales Navigator campaign <strong>"${campaignTitle}"</strong> encountered an error and couldn't complete successfully.
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
              <strong>LinkedIn Session Issues:</strong><br>
              • Check if your LinkedIn session cookie is valid and active<br>
              • Make sure you're logged into LinkedIn Sales Navigator<br>
              • Try logging out and back into LinkedIn<br><br>
              <strong>Search URL Issues:</strong><br>
              • Verify your Sales Navigator search URL is correct<br>
              • Make sure the search returns results when run manually<br>
              • Try simplifying your search criteria
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns/${campaignId}" 
               style="background-color: #4f46e5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Try Again
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            No credits were charged for this failed attempt. If this issue persists, please contact our support team with the error details above.<br><br>
            The HirePilot Team
          </p>
        </div>
      `;

      await sendEmail(userEmail, emailSubject, `Sales Navigator campaign "${campaignTitle}" failed: ${errorMessage}`, emailHtml);
      console.log('[Sales Navigator Notifications] Error email sent to:', userEmail);
    }

    // Send Slack notification (if enabled)
    if (user.slack_notifications !== false) {
      const slackMessage = `❌ *Sales Navigator Campaign: ${campaignTitle}* failed\n🔧 Error: ${errorMessage}\n${searchSummary ? `🔍 Search: ${searchSummary}\n` : ''}💡 Check LinkedIn session and search URL\n💳 No credits charged (campaign failed)`;
      await notifySlack(slackMessage);
      console.log('[Sales Navigator Notifications] Error Slack notification sent');
    }

  } catch (error) {
    console.error('[Sales Navigator Notifications] Error sending error notifications:', error);
  }
} 