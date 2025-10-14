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
  const DEFAULT_HTML = `
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; padding: 32px; color: #f8fafc;">
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <img src="https://thehirepilot.com/logo-light.png" alt="HirePilot Logo" width="120" />
            </td>
          </tr>
          <tr>
            <td>
              <h1 style="font-size: 20px; margin-bottom: 24px;">🚀 New Candidate Submitted</h1>
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Hi <strong>{{ownerName}}</strong>,
                <br /><br />
                See the attached candidate for your review! If thumbs up I'd like to submit the candidate to the hiring manager:
              </p>
              <table cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: separate; border-spacing: 0 10px;">
                <tr style="background-color: #334155; border-radius: 8px;">
                  <td style="width: 35%; font-weight: bold;">Name:</td>
                  <td>{{candidateName}}</td>
                </tr>
                <tr style="background-color: #334155;">
                  <td style="font-weight: bold;">Position:</td>
                  <td>{{jobTitle}}</td>
                </tr>
                <tr style="background-color: #334155;">
                  <td style="font-weight: bold;">Email:</td>
                  <td><a href="mailto:{{email}}" style="color: #3b82f6;">{{email}}</a></td>
                </tr>
                <tr style="background-color: #334155;">
                  <td style="font-weight: bold;">Profile Link:</td>
                  <td><a href="{{linkedin}}" style="color: #3b82f6;">{{linkedin}}</a></td>
                </tr>
                <tr style="background-color: #334155;">
                  <td style="font-weight: bold;">Years of Experience:</td>
                  <td>{{years}}</td>
                </tr>
              </table>
              <div style="margin-top: 32px;">
                <h3 style="margin-bottom: 8px; font-size: 16px;">📈 Notable Impact</h3>
                <p style="background-color: #334155; padding: 16px; border-radius: 8px; white-space: pre-wrap;">{{impact}}</p>
                <h3 style="margin: 24px 0 8px; font-size: 16px;">💡 Motivation</h3>
                <p style="background-color: #334155; padding: 16px; border-radius: 8px; white-space: pre-wrap;">{{motivation}}</p>
                <h3 style="margin: 24px 0 8px; font-size: 16px;">🏆 Additional Accolades</h3>
                <p style="background-color: #334155; padding: 16px; border-radius: 8px; white-space: pre-wrap;">{{accolades}}</p>
                <h3 style="margin: 24px 0 8px; font-size: 16px;">📎 Resume</h3>
                <p>{{resume}} ? <a href="{{resume}}" style="color: #3b82f6;">View Resume</a> : '-' </p>
              </div>
              <p style="margin-top: 40px; font-size: 14px; color: #94a3b8;">
                Regards,<br />
                {{collaboratorName}}
              </p>
            </td>
          </tr>
        </table>
        <p style="margin-top: 16px; font-size: 12px; color: #64748b;">Sent via <strong>HirePilot</strong></p>
      </td>
    </tr>
  </table>`;
  let html = '';
  try { html = fs.readFileSync(tplPath, 'utf-8'); } catch { html = DEFAULT_HTML; }
  if (!html) html = DEFAULT_HTML;

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


