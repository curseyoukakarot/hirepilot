import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export type CandidateSubmission = {
  ownerEmail: string | null;
  ownerName?: string | null;
  jobTitle: string;
  candidateName: string;
  email: string;
  linkedin?: string | null;
  years?: string | null;
  impact?: string | null;
  motivation?: string | null;
  accolades?: string | null;
  resume?: string | null;
  collaboratorName?: string | null;
};

function renderTemplate(html: string, vars: Record<string, string | null | undefined>) {
  return html.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

export async function sendCandidateSubmissionEmail(payload: CandidateSubmission) {
  if (!process.env.SENDGRID_API_KEY || !payload.ownerEmail) return;
  const subject = `New Candidate Submitted: ${payload.candidateName} for ${payload.jobTitle}`;
  const tplPath = path.resolve(__dirname, '../../../emails/candidates/submission.html');
  let html = '';
  try { html = fs.readFileSync(tplPath, 'utf-8'); } catch {}
  if (!html) {
    html = `Hi {{ownerName}},<br/><br/>New candidate submitted for <b>{{jobTitle}}</b>.<br/><br/>Name: {{candidateName}}<br/>Email: {{email}}<br/>Profile: {{linkedin}}<br/>Years: {{years}}<br/><br/><b>Impact</b><br/>{{impact}}<br/><br/><b>Motivation</b><br/>{{motivation}}<br/><br/><b>Accolades</b><br/>{{accolades}}<br/><br/>Resume: {{resume}}<br/><br/>Regards,<br/>{{collaboratorName}}`;
  }

  const compiled = renderTemplate(html, {
    ownerName: payload.ownerName || '',
    jobTitle: payload.jobTitle,
    candidateName: payload.candidateName,
    email: payload.email,
    linkedin: payload.linkedin || '',
    years: payload.years || '',
    impact: payload.impact || '',
    motivation: payload.motivation || '',
    accolades: payload.accolades || '',
    resume: payload.resume || '',
    collaboratorName: payload.collaboratorName || 'Collaborator'
  });

  await sgMail.send({
    to: payload.ownerEmail,
    from: process.env.FROM_EMAIL || 'no-reply@thehirepilot.com',
    subject,
    html: compiled
  });
}


