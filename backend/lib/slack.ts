import axios from 'axios';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export async function notifySlack(message: string) {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('No SLACK_WEBHOOK_URL set, skipping notification');
    return;
  }

  try {
    await axios.post(SLACK_WEBHOOK_URL, { text: message });
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

export const SlackMessages = {
  campaignLaunched: (title: string, email: string) => 
    `🚀 New campaign **${title}** launched by ${email}`,
  affiliateSignedUp: (email: string, referral: string) =>
    `🤝 New Affiliate Signup\n• Email: ${email}\n• Referral Code: ${referral}`,
  
  leadsScraped: (title: string, count: number) =>
    `📥 ${count} leads scraped for campaign **${title}**`,
  
  leadsEnriched: (title: string, count: number) =>
    `⚡ ${count} leads enriched & ready for campaign **${title}**`
}; 