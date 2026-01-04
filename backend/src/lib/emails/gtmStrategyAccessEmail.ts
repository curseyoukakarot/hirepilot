import sgMail from '@sendgrid/mail';

type Vars = {
  first_name: string;
  guide_url: string;
  notion_url: string;
  support_email: string;
  company_name: string;
};

function renderTemplate(html: string, vars: Record<string, string | null | undefined>) {
  return html.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

// Stored inline to avoid filesystem/template loader issues across deploy targets.
const GTM_ACCESS_EMAIL_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>Access Granted — HirePilot GTM Strategy Guide</title>
    <!--[if mso]>
      <style type="text/css">
        body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
      </style>
    <![endif]-->
  </head>
  <body style="margin:0; padding:0; background:#0b1020;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      Your access is live. Open the GTM Strategy Guide + templates and start building your outreach engine today.
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b1020; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px; border-radius:18px; overflow:hidden; border:1px solid rgba(255,255,255,0.10); background:#0f1733;">
            <tr>
              <td style="padding:0;">
                <div style="height:6px; background:linear-gradient(90deg,#7c5cff,#38bdf8,#22c55e);"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 22px 10px 22px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td valign="middle">
                      <div style="display:inline-block; width:36px; height:36px; border-radius:12px; background:rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.10); vertical-align:middle; text-align:center; line-height:36px;">
                        <span style="display:inline-block; width:14px; height:14px; border-radius:999px; background:linear-gradient(135deg,#7c5cff,#38bdf8);"></span>
                      </div>
                      <span style="margin-left:10px; vertical-align:middle; font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:700; font-size:16px;">
                        HirePilot
                      </span>
                      <div style="margin-left:50px; margin-top:2px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.70); font-size:12px;">
                        GTM Strategy Guide • 2026 Blueprint
                      </div>
                    </td>
                    <td align="right" valign="middle">
                      <span style="font-family:Arial, Helvetica, sans-serif; font-size:12px; color:rgba(255,255,255,0.70);">
                        Access: <span style="color:#22c55e; font-weight:700;">Granted</span>
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 22px 18px 22px;">
                <div style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:800; font-size:28px; line-height:1.15;">
                  You’re in, {{first_name}} 🔓
                </div>
                <div style="margin-top:10px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.78); font-size:15px; line-height:1.6;">
                  Welcome to the <strong style="color:#ffffff;">multi-million dollar GTM Strategy Guide</strong> — the blueprint for turning outbound into a
                  <strong style="color:#ffffff;">repeatable pipeline engine</strong> you can run weekly without chaos.
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                  <tr>
                    <td style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); font-family:Arial, Helvetica, sans-serif; font-size:12px; color:rgba(255,255,255,0.75);">
                      80–90% automation-first
                    </td>
                    <td width="8"></td>
                    <td style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); font-family:Arial, Helvetica, sans-serif; font-size:12px; color:rgba(255,255,255,0.75);">
                      Safety + deliverability rules
                    </td>
                    <td width="8"></td>
                    <td style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); font-family:Arial, Helvetica, sans-serif; font-size:12px; color:rgba(255,255,255,0.75);">
                      Dashboards that drive decisions
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 22px 18px 22px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius:16px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04);">
                  <tr>
                    <td style="padding:18px;">
                      <div style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:700; font-size:14px;">
                        ✅ Your access links
                      </div>
                      <div style="margin-top:6px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.75); font-size:13px; line-height:1.55;">
                        Start with the web guide. If you prefer Notion, use the Notion mirror.
                      </div>
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                        <tr>
                          <td>
                            <a href="{{guide_url}}"
                               style="display:inline-block; padding:12px 16px; border-radius:14px; text-decoration:none; font-family:Arial, Helvetica, sans-serif; font-weight:800; font-size:14px; color:#0b1020; background:linear-gradient(90deg,#7c5cff,#38bdf8);">
                              Open the GTM Strategy Guide →
                            </a>
                          </td>
                          <td width="10"></td>
                          <td>
                            <a href="{{notion_url}}"
                               style="display:inline-block; padding:12px 16px; border-radius:14px; text-decoration:none; font-family:Arial, Helvetica, sans-serif; font-weight:700; font-size:14px; color:#ffffff; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14);">
                              View in Notion
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:12px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.58); font-size:12px; line-height:1.45;">
                        If the buttons don’t work, copy/paste:
                        <br />
                        <span style="color:rgba(255,255,255,0.80);">{{guide_url}}</span>
                        <br />
                        <span style="color:rgba(255,255,255,0.80);">{{notion_url}}</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 22px 18px 22px;">
                <div style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:800; font-size:16px; margin-bottom:10px;">
                  What you’ll build (in order)
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="50%" style="padding-right:6px;">
                      <div style="border-radius:16px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04); padding:14px;">
                        <div style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:700; font-size:13px;">
                          1) System Setup (Build Once)
                        </div>
                        <div style="margin-top:6px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.72); font-size:12.5px; line-height:1.5;">
                          Personas → Campaigns → Schedules → Dashboards.
                          One source of truth, no scattered tools.
                        </div>
                      </div>
                    </td>
                    <td width="50%" style="padding-left:6px;">
                      <div style="border-radius:16px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04); padding:14px;">
                        <div style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:700; font-size:13px;">
                          2) Daily Cadence Engine
                        </div>
                        <div style="margin-top:6px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.72); font-size:12.5px; line-height:1.5;">
                          Scheduled sequences + LinkedIn actions + follow-ups
                          to generate meetings weekly.
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr><td colspan="2" height="12"></td></tr>
                  <tr>
                    <td width="50%" style="padding-right:6px;">
                      <div style="border-radius:16px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04); padding:14px;">
                        <div style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:700; font-size:13px;">
                          3) ABM Touches + Warm Paths
                        </div>
                        <div style="margin-top:6px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.72); font-size:12.5px; line-height:1.5;">
                          8-touch plays for your “must-win” accounts with a simple weekly rhythm.
                        </div>
                      </div>
                    </td>
                    <td width="50%" style="padding-left:6px;">
                      <div style="border-radius:16px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.04); padding:14px;">
                        <div style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:700; font-size:13px;">
                          4) Dashboards that Scale
                        </div>
                        <div style="margin-top:6px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.72); font-size:12.5px; line-height:1.5;">
                          See meetings → proposals → wins.
                          Double down on what prints money.
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 22px 20px 22px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius:16px; border:1px solid rgba(34,197,94,0.22); background:rgba(34,197,94,0.08);">
                  <tr>
                    <td style="padding:16px;">
                      <div style="font-family:Arial, Helvetica, sans-serif; color:#ffffff; font-weight:800; font-size:14px;">
                        🚀 Quick Start (do this now)
                      </div>
                      <ol style="margin:10px 0 0 18px; padding:0; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.78); font-size:13px; line-height:1.55;">
                        <li><strong style="color:#fff;">Open the Guide</strong> and follow it in order.</li>
                        <li>Create <strong style="color:#fff;">1 Persona</strong> + <strong style="color:#fff;">1 Campaign</strong> in HirePilot.</li>
                        <li>Schedule <strong style="color:#fff;">your first 7-day outreach loop</strong> (start small).</li>
                        <li>Turn on the <strong style="color:#fff;">Executive Overview dashboard</strong> to track pace.</li>
                      </ol>
                      <div style="margin-top:10px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.65); font-size:12px;">
                        Time-to-live: <strong style="color:#fff;">~60–120 minutes</strong> for your first working system.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 22px 22px 22px; border-top:1px solid rgba(255,255,255,0.10);">
                <div style="font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.70); font-size:12px; line-height:1.6;">
                  Need help setting this up for your exact offer?
                  Reply to this email or contact <a href="mailto:{{support_email}}" style="color:#38bdf8; text-decoration:none; font-weight:700;">{{support_email}}</a>.
                </div>
                <div style="margin-top:10px; font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.55); font-size:11px; line-height:1.5;">
                  Sent by {{company_name}} via HirePilot. If you didn’t request this, you can ignore this email.
                </div>
              </td>
            </tr>
          </table>
          <div style="height:18px;"></div>
          <div style="font-family:Arial, Helvetica, sans-serif; color:rgba(255,255,255,0.45); font-size:11px; text-align:center;">
            © HirePilot • Built for founders who want predictable pipeline.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export function getDefaultGtmGuideUrls() {
  const base =
    process.env.FRONTEND_URL ||
    process.env.APP_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.thehirepilot.com';
  const normalized = String(base).replace(/\/$/, '');
  const guide_url = `${normalized}/gtm-strategy`;
  const notion_url = process.env.GTM_GUIDE_NOTION_URL
    ? String(process.env.GTM_GUIDE_NOTION_URL)
    : guide_url;
  return { guide_url, notion_url };
}

export async function sendGtmStrategyAccessEmail(params: {
  to: string;
  firstName?: string | null;
  guideUrl?: string;
  notionUrl?: string;
}) {
  const first_name = (params.firstName || '').trim() || 'there';
  const { guide_url, notion_url } = getDefaultGtmGuideUrls();
  const compiled = renderTemplate(GTM_ACCESS_EMAIL_HTML, {
    first_name,
    guide_url: params.guideUrl || guide_url,
    notion_url: params.notionUrl || notion_url,
    support_email: 'support@thehirepilot.com',
    company_name: 'HirePilot',
  } satisfies Vars);

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SendGrid API key not configured');
  sgMail.setApiKey(apiKey);

  // Hard-coded sender per request
  await sgMail.send({
    to: params.to,
    from: 'noreply@thehirepilot.com',
    subject: 'Access Granted — HirePilot GTM Strategy Guide',
    html: compiled,
  } as any);
}


