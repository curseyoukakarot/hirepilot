import React from 'react';

export type ResumePdfData = {
  contact?: { email?: string; linkedin?: string; name?: string };
  skills?: string[];
  education?: string[];
  experience?: Array<{
    company?: string;
    title?: string;
    location?: string;
    dates?: string;
    whyHiredSummary?: string;
    bullets?: string[];
  }>;
};

export function ResumePdfTemplate({ data }: { data: ResumePdfData }) {
  return (
    <div className="resume-page">
      <style>{`
        @page { size: Letter; margin: 0.55in; }
        .resume-page {
          font-family: "EB Garamond", Garamond, serif;
          font-size: 8pt;           /* BODY = 8 */
          line-height: 1.25;
          color: #111827;
        }
        .contact-email { font-size: 12pt; font-weight: 600; margin-bottom: 2pt; }
        .contact-linkedin { font-size: 10pt; margin-bottom: 10pt; }
        .section-title{
          font-size: 11pt;          /* TITLES = 11 */
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #365F91;           /* template blue vibe */
          margin: 10pt 0 4pt;
        }
        .role-header { font-weight: 700; margin-top: 8pt; }
        .role-why { margin: 3pt 0 4pt; }
        ul { margin: 0; padding-left: 14pt; }
        li { margin: 0 0 2pt 0; }
      `}</style>

      <div className="contact-email">{data?.contact?.email || ''}</div>
      <div className="contact-linkedin">{data?.contact?.linkedin || ''}</div>

      {!!data?.skills?.length && (
        <>
          <div className="section-title">Skills</div>
          <div>{data.skills.join(' • ')}</div>
        </>
      )}

      {!!data?.education?.length && (
        <>
          <div className="section-title">Education & Certifications</div>
          {data.education.map((e: any, idx: number) => (
            <div key={idx}>{e}</div>
          ))}
        </>
      )}

      {!!data?.experience?.length && (
        <>
          <div className="section-title">Professional Experience</div>
          {data.experience.map((r: any, idx: number) => (
            <div key={idx}>
              <div className="role-header">
                {r.company} | {r.title} {r.dates ? ` ${r.dates}` : ''}
              </div>
              {r.whyHiredSummary && <div className="role-why">{r.whyHiredSummary}</div>}
              {!!r.bullets?.length && (
                <ul>
                  {r.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

