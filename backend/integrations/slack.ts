export async function sendFormSubmissionSlack(form: { id: string; title: string }, responseId: string) {
  try {
    // No-op by default; integrate with existing Slack service if configured
    // Example: send a message with form title and a link to view the response
    return;
  } catch {}
}


