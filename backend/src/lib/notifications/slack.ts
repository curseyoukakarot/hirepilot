import axios from 'axios';

export async function sendSlackCandidateNotification(candidate: {
  name: string;
  jobTitle: string;
  resume?: string | null;
  motivation?: string | null;
}, webhookUrl?: string | null) {
  const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  const truncated = (candidate.motivation || '').slice(0, 150);
  const text = `🚀 New Candidate Submission\n📌 ${candidate.name} for ${candidate.jobTitle}\n🧠 Motivation: ${truncated}`;
  await axios.post(url, {
    text,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*🚀 New Candidate Submission*` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${candidate.name}* for *${candidate.jobTitle}*` } },
      ...(candidate.resume ? [{ type: 'section', text: { type: 'mrkdwn', text: `<${candidate.resume}|View Resume>` } }] : []),
      { type: 'section', text: { type: 'mrkdwn', text: `*Motivation*\n${truncated}` } }
    ]
  });
}


