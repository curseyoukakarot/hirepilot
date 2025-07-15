import { sendEmail } from './emailService';
import { notifySlack } from '../lib/slack';

export async function sendSuccessNotifications(user: any, campaign: any, leadCount: number) {
  try {
    console.log('[PhantomBuster Notifications] sendSuccessNotifications called with:', {
      user: user?.email,
      campaign: campaign?.title,
      leadCount
    });
    
    const userEmail = user.email;
    const userName = user.first_name || 'there';
    const campaignTitle = campaign.title || 'Your campaign';

    // Create email content
    const emailSubject = `🎉 Your leads are ready! ${leadCount} new prospects found`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #28a745; margin: 0;">🎉 Leads Ready!</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
        
        <p style="font-size: 16px; line-height: 1.5;">
          Great news! Your campaign <strong>"${campaignTitle}"</strong> has successfully found 
          <strong style="color: #28a745;">${leadCount} new prospects</strong> and they're now ready in HirePilot.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            View Your Leads
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          You can now review, enrich, and start reaching out to these prospects. 
          Happy recruiting!<br><br>
          The HirePilot Team
        </p>
      </div>
    `;

    // Send email notification
    if (userEmail) {
      await sendEmail(userEmail, emailSubject, `Your campaign "${campaignTitle}" found ${leadCount} new leads!`, emailHtml);
      console.log('[PhantomBuster Notifications] Success email sent to:', userEmail);
    }

    // Send Slack notification
    const slackMessage = `🎉 *${campaignTitle}* completed successfully!\n✅ Found ${leadCount} new leads\n👉 Ready to review in HirePilot`;
    await notifySlack(slackMessage);
    console.log('[PhantomBuster Notifications] Success Slack notification sent');

  } catch (error) {
    console.error('[PhantomBuster Notifications] Error sending success notifications:', error);
  }
}

export async function sendNoResultsNotifications(user: any, campaign: any) {
  try {
    const userEmail = user.email;
    const userName = user.first_name || 'there';
    const campaignTitle = campaign.title || 'Your campaign';

    // Create email content
    const emailSubject = `Campaign completed - No leads found`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffc107; margin: 0;">⚠️ Campaign Complete</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
        
        <p style="font-size: 16px; line-height: 1.5;">
          Your campaign <strong>"${campaignTitle}"</strong> has completed, but unfortunately no leads were found that match your criteria.
        </p>
        
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">💡 Tips to improve results:</h3>
          <ul style="color: #856404; margin-bottom: 0;">
            <li>Try broadening your search criteria</li>
            <li>Check if your LinkedIn search URL is working correctly</li>
            <li>Consider different job titles or locations</li>
            <li>Ensure your LinkedIn session is still active</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Try Another Search
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          Need help optimizing your search? Feel free to reach out to our support team.<br><br>
          The HirePilot Team
        </p>
      </div>
    `;

    // Send email notification
    if (userEmail) {
      await sendEmail(userEmail, emailSubject, `Your campaign "${campaignTitle}" completed but found no leads.`, emailHtml);
      console.log('[PhantomBuster Notifications] No results email sent to:', userEmail);
    }

    // Send Slack notification
    const slackMessage = `⚠️ *${campaignTitle}* completed but found no leads\n💡 Consider adjusting search criteria`;
    await notifySlack(slackMessage);
    console.log('[PhantomBuster Notifications] No results Slack notification sent');

  } catch (error) {
    console.error('[PhantomBuster Notifications] Error sending no results notifications:', error);
  }
}

export async function sendErrorNotifications(user: any, campaign: any, errorMessage: string) {
  try {
    const userEmail = user.email;
    const userName = user.first_name || 'there';
    const campaignTitle = campaign.title || 'Your campaign';

    // Create email content
    const emailSubject = `❌ Campaign failed - "${campaignTitle}"`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc3545; margin: 0;">❌ Campaign Failed</h1>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5;">Hi ${userName},</p>
        
        <p style="font-size: 16px; line-height: 1.5;">
          Unfortunately, your campaign <strong>"${campaignTitle}"</strong> encountered an error and couldn't complete successfully.
        </p>
        
        <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <h3 style="color: #721c24; margin-top: 0;">Error Details:</h3>
          <p style="color: #721c24; margin-bottom: 0; font-family: monospace; font-size: 14px;">${errorMessage}</p>
        </div>
        
        <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
          <h3 style="color: #0c5460; margin-top: 0;">🔧 Common fixes:</h3>
          <ul style="color: #0c5460; margin-bottom: 0;">
            <li>Check if your LinkedIn session cookie is still valid</li>
            <li>Verify your search URL is accessible</li>
            <li>Ensure your PhantomBuster account has sufficient credits</li>
            <li>Try running the campaign again in a few minutes</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://app.thehirepilot.com'}/campaigns" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
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
      await sendEmail(userEmail, emailSubject, `Your campaign "${campaignTitle}" failed: ${errorMessage}`, emailHtml);
      console.log('[PhantomBuster Notifications] Error email sent to:', userEmail);
    }

    // Send Slack notification
    const slackMessage = `❌ *${campaignTitle}* failed\n🔧 Error: ${errorMessage}\n💡 Check campaign settings and try again`;
    await notifySlack(slackMessage);
    console.log('[PhantomBuster Notifications] Error Slack notification sent');

  } catch (error) {
    console.error('[PhantomBuster Notifications] Error sending error notifications:', error);
  }
} 