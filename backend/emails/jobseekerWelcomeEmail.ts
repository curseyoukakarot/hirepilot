type JobSeekerWelcomeTokens = {
  first_name: string;
  app_url: string;
  onboarding_url: string;
  resume_builder_url: string;
  landing_page_url: string;
  year: string;
  unsubscribe_url: string;
};

export function jobseekerWelcomeEmail(tokens: JobSeekerWelcomeTokens): string {
  // Keep the HTML as a single template string and do a lightweight token replace.
  // This avoids filesystem template loading issues in production deployments.
  let html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light only" />
    <title>Welcome to HirePilot Jobs</title>
    <!--[if mso]>
      <style type="text/css">
        body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
      </style>
    <![endif]-->
    <style>
      html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; }
      * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
      table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
      img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
      a { text-decoration:none; }
      @media screen and (max-width: 600px) {
        .container { width:100% !important; }
        .px { padding-left:16px !important; padding-right:16px !important; }
        .py { padding-top:16px !important; padding-bottom:16px !important; }
        .hero { padding:22px 16px !important; }
        .h1 { font-size:24px !important; line-height:30px !important; }
        .p { font-size:15px !important; line-height:22px !important; }
        .btn { display:block !important; width:100% !important; }
        .btn a { display:block !important; }
      }
    </style>
  </head>
  <body style="background:#0B1220; margin:0; padding:0;">
    <div style="display:none; font-size:1px; color:#0B1220; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
      Welcome to HirePilot Jobs — complete onboarding to unlock 100 free credits and start reaching decision makers.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0B1220;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
            <tr>
              <td align="left" style="padding:0 8px 14px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#C7D2FE; font-size:13px; letter-spacing:0.3px;">
                      <span style="font-weight:700; color:#E0E7FF;">HirePilot Jobs</span>
                      <span style="color:#64748B;">&nbsp;•&nbsp;Job Seeker Platform</span>
                    </td>
                    <td align="right" style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:13px;">
                      <a href="{{app_url}}" style="color:#93C5FD;">Open app</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="hero" style="background:linear-gradient(135deg,#111C33 0%, #0F172A 60%, #0B1220 100%); border:1px solid #1E293B; border-radius:18px; padding:28px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                      <div class="h1" style="color:#FFFFFF; font-size:28px; line-height:34px; font-weight:800; margin:0 0 10px 0;">
                        Welcome to HirePilot Jobs, {{first_name}} 👋
                      </div>
                      <div class="p" style="color:#CBD5E1; font-size:16px; line-height:24px; margin:0 0 18px 0;">
                        You’re in the right place if you’re ready to stop “spray-and-pray applying” and start getting
                        responses by reaching the people who actually make hiring decisions.
                      </div>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
                        <tr>
                          <td class="btn" align="left" style="background:#3B82F6; border-radius:12px;">
                            <a href="{{onboarding_url}}"
                              style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                                     display:inline-block; padding:14px 18px; color:#FFFFFF; font-weight:800; font-size:14px; letter-spacing:0.2px;">
                              Start onboarding • Unlock 100 free credits
                            </a>
                          </td>
                          <td width="12"></td>
                          <td align="left" class="btn" style="border:1px solid #334155; border-radius:12px;">
                            <a href="{{resume_builder_url}}"
                              style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                                     display:inline-block; padding:14px 18px; color:#E2E8F0; font-weight:700; font-size:14px;">
                              Build your resume
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="height:14px; line-height:14px; font-size:1px;">&nbsp;</div>
                      <div style="color:#94A3B8; font-size:13px; line-height:20px;">
                        Tip: credits are used for AI actions (resume + outreach assets + job prep). Completing onboarding unlocks your first 100.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="height:14px;"></td></tr>
            <tr>
              <td style="background:#0F172A; border:1px solid #1E293B; border-radius:18px; padding:22px 22px;" class="px py">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                      <div style="color:#FFFFFF; font-size:16px; font-weight:800; margin:0 0 8px 0;">
                        The HirePilot Jobs Method: Decision Makers &gt; Applications
                      </div>
                      <div class="p" style="color:#CBD5E1; font-size:15px; line-height:23px; margin:0 0 14px 0;">
                        Most applicants compete in the loudest room: job boards. We’ll help you compete in a quieter lane:
                        <span style="color:#E0E7FF; font-weight:700;">direct outreach to hiring managers, functional leaders, and recruiters</span>
                        with a crisp story, strong assets, and a simple next step.
                      </div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
                        <tr>
                          <td valign="top" width="22" style="color:#60A5FA; font-size:18px; line-height:22px;">✓</td>
                          <td style="color:#CBD5E1; font-size:15px; line-height:23px;">
                            <strong style="color:#FFFFFF;">Clarity:</strong> define your target role so your message is specific (and believable).
                          </td>
                        </tr>
                        <tr>
                          <td valign="top" width="22" style="color:#60A5FA; font-size:18px; line-height:22px;">✓</td>
                          <td style="color:#CBD5E1; font-size:15px; line-height:23px;">
                            <strong style="color:#FFFFFF;">Assets:</strong> a sharp resume + a simple landing page that proves credibility fast.
                          </td>
                        </tr>
                        <tr>
                          <td valign="top" width="22" style="color:#60A5FA; font-size:18px; line-height:22px;">✓</td>
                          <td style="color:#CBD5E1; font-size:15px; line-height:23px;">
                            <strong style="color:#FFFFFF;">Action:</strong> outreach angles that get replies (not “just following up”).
                          </td>
                        </tr>
                      </table>
                      <div style="height:10px; line-height:10px; font-size:1px;">&nbsp;</div>
                      <div style="border-top:1px solid #1E293B;"></div>
                      <div style="height:14px; line-height:14px; font-size:1px;">&nbsp;</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                      <div style="color:#FFFFFF; font-size:16px; font-weight:800; margin:0 0 10px 0;">
                        What you can build right now
                      </div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:14px; border:1px solid #1E293B; border-radius:14px; background:#0B1220;" valign="top">
                            <div style="color:#E0E7FF; font-weight:800; font-size:14px; margin:0 0 6px 0;">
                              Resume Builder
                            </div>
                            <div style="color:#CBD5E1; font-size:14px; line-height:21px; margin:0;">
                              Turn your experience into a clean, structured resume optimized for your target role — fast.
                            </div>
                            <div style="height:10px; line-height:10px; font-size:1px;">&nbsp;</div>
                            <a href="{{resume_builder_url}}" style="color:#93C5FD; font-weight:700; font-size:14px;">Open Resume Builder →</a>
                          </td>
                        </tr>
                        <tr><td style="height:12px;"></td></tr>
                        <tr>
                          <td style="padding:14px; border:1px solid #1E293B; border-radius:14px; background:#0B1220;" valign="top">
                            <div style="color:#E0E7FF; font-weight:800; font-size:14px; margin:0 0 6px 0;">
                              Landing Page
                            </div>
                            <div style="color:#CBD5E1; font-size:14px; line-height:21px; margin:0;">
                              Create a simple page you can link in outreach — your story, proof, projects, and a clear “book a call” CTA.
                            </div>
                            <div style="height:10px; line-height:10px; font-size:1px;">&nbsp;</div>
                            <a href="{{landing_page_url}}" style="color:#93C5FD; font-weight:700; font-size:14px;">Build your page →</a>
                          </td>
                        </tr>
                      </table>
                      <div style="height:14px; line-height:14px; font-size:1px;">&nbsp;</div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                        style="border:1px solid #334155; background:linear-gradient(135deg,#0B1220 0%, #0F172A 100%); border-radius:14px;">
                        <tr>
                          <td style="padding:16px;">
                            <div style="color:#FFFFFF; font-weight:900; font-size:14px; margin:0 0 6px 0;">
                              🎁 Unlock 100 free credits
                            </div>
                            <div style="color:#CBD5E1; font-size:14px; line-height:21px; margin:0 0 12px 0;">
                              Complete the onboarding flow to activate your account and get the credits you’ll use to generate your resume,
                              outreach angles, and job prep assets.
                            </div>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td class="btn" align="left" style="background:#22C55E; border-radius:12px;">
                                  <a href="{{onboarding_url}}"
                                    style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                                           display:inline-block; padding:12px 16px; color:#04110A; font-weight:900; font-size:14px;">
                                    Start onboarding
                                  </a>
                                </td>
                                <td width="12"></td>
                                <td align="left" style="color:#94A3B8; font-size:13px;">
                                  Takes ~5 minutes
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="height:14px;"></td></tr>
            <tr>
              <td style="padding:0 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#94A3B8; font-size:12px; line-height:18px;">
                      If you have any issues, just reply to this email — we read every message.
                      <br />
                      <span style="color:#64748B;">© {{year}} HirePilot Jobs. All rights reserved.</span>
                    </td>
                    <td align="right" style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:12px;">
                      <a href="{{unsubscribe_url}}" style="color:#64748B;">Unsubscribe</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const replace = (k: keyof JobSeekerWelcomeTokens, v: string) => {
    html = html.split(`{{${k}}}`).join(v || '');
  };

  replace('first_name', tokens.first_name || 'there');
  replace('app_url', tokens.app_url);
  replace('onboarding_url', tokens.onboarding_url);
  replace('resume_builder_url', tokens.resume_builder_url);
  replace('landing_page_url', tokens.landing_page_url);
  replace('year', tokens.year);
  replace('unsubscribe_url', tokens.unsubscribe_url);

  return html;
}


