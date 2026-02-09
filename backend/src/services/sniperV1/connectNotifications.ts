import axios from 'axios';
import { sniperSupabaseDb } from './supabase';
import { sendEmail as sendgridSend } from '../../integrations/sendgrid';

type UserNotificationSettings = {
  emailAllowed: boolean;
  slackAllowed: boolean;
  toEmail: string;
  firstName: string;
  slackWebhook: string;
};

type QueueNotificationArgs = {
  userId: string;
  workspaceId: string;
  jobId: string;
  totalTargets: number;
  profileUrl?: string | null;
  note?: string | null;
  estimatedRate?: string | null;
  isBulk: boolean;
};

type ResultNotificationArgs = {
  userId: string;
  workspaceId: string;
  jobId: string;
  profileUrl: string;
  finalStatus: string;
  message?: string | null;
  note?: string | null;
};

const TEMPLATE_QUEUED_SINGLE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>Connection Request Queued</title>
    <style>
      /* Email-safe resets */
      html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; }
      * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
      table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
      img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
      a { text-decoration:none; }
      .container { width:100%; background:#0b1020; }
      .wrap { width:100%; max-width:640px; margin:0 auto; }
      .card { background:#0f172a; border:1px solid rgba(148,163,184,0.18); border-radius:18px; }
      .muted { color:#94a3b8; }
      .text { color:#e2e8f0; }
      .h1 { font-size:22px; line-height:28px; font-weight:800; margin:0; }
      .h2 { font-size:16px; line-height:22px; font-weight:700; margin:0; }
      .p { margin:0; font-size:14px; line-height:20px; }
      .btn {
        display:inline-block; padding:12px 16px; border-radius:12px;
        background:linear-gradient(135deg,#4f46e5,#8b5cf6); color:#ffffff !important;
        font-weight:700; font-size:14px;
      }
      .btn-secondary{
        display:inline-block; padding:10px 14px; border-radius:12px;
        background:rgba(148,163,184,0.12); color:#e2e8f0 !important;
        font-weight:600; font-size:13px; border:1px solid rgba(148,163,184,0.18);
      }
      .chip {
        display:inline-block; padding:6px 10px; border-radius:999px;
        font-size:12px; font-weight:700; letter-spacing:.2px;
        background:rgba(34,197,94,0.12); color:#22c55e; border:1px solid rgba(34,197,94,0.22);
      }
      .divider { height:1px; background:rgba(148,163,184,0.18); width:100%; }
      .mini { font-size:12px; line-height:18px; }
      @media (max-width:480px){
        .h1{ font-size:20px; }
      }
    </style>
  </head>
  <body class="container">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020;">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" class="wrap" width="640" cellspacing="0" cellpadding="0">
            <!-- Header -->
            <tr>
              <td style="padding:0 0 14px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="padding:0 6px;">
                      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                        <div style="display:inline-block; padding:10px 12px; border-radius:14px; background:rgba(79,70,229,0.15); border:1px solid rgba(99,102,241,0.25);">
                          <span style="color:#c7d2fe; font-weight:800; font-size:13px;">HirePilot</span>
                          <span style="color:#94a3b8; font-weight:700; font-size:13px;"> • Sniper</span>
                        </div>
                      </div>
                    </td>
                    <td align="right" style="padding:0 6px;">
                      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                        <span class="chip">QUEUED</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero -->
            <tr>
              <td class="card" style="padding:22px;">
                <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
                  <p class="h1 text">Connection request queued ✅</p>
                  <p class="p muted" style="margin-top:8px;">
                    Your Sniper action is in motion. We’ll run it in the background and notify you when it completes.
                  </p>

                  <div style="margin-top:16px;" class="divider"></div>

                  <!-- Details -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                    <tr>
                      <td valign="top" style="padding:0 10px 12px 0;">
                        <div class="h2 text">Target</div>
                        <p class="p muted" style="margin-top:6px;">
                          {{lead_name}}<br/>
                          <span style="color:#cbd5e1;">{{profile_url}}</span>
                        </p>
                      </td>
                      <td valign="top" style="padding:0 0 12px 10px;">
                        <div class="h2 text">Run details</div>
                        <p class="p muted" style="margin-top:6px;">
                          Action: <span style="color:#e2e8f0; font-weight:700;">LinkedIn Connect</span><br/>
                          Workspace: <span style="color:#e2e8f0; font-weight:700;">{{workspace_name}}</span><br/>
                          Job ID: <span style="color:#e2e8f0; font-weight:700;">{{job_id}}</span>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Optional note -->
                  {{#if note}}
                  <div style="margin-top:6px; padding:14px; border-radius:14px; background:rgba(148,163,184,0.08); border:1px solid rgba(148,163,184,0.16);">
                    <div class="h2 text">Message note</div>
                    <p class="p muted" style="margin-top:8px; white-space:pre-wrap;">{{note}}</p>
                  </div>
                  {{/if}}

                  <!-- CTAs -->
                  <div style="margin-top:18px;">
                    <a class="btn" href="{{activity_url}}" target="_blank" rel="noopener">View Sniper Activity</a>
                    <span style="display:inline-block; width:10px;"></span>
                    <a class="btn-secondary" href="{{lead_url}}" target="_blank" rel="noopener">Open Lead</a>
                  </div>

                  <p class="mini muted" style="margin-top:14px;">
                    Tip: If your LinkedIn session needs reconnecting, we’ll pause and prompt you in-app.
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:14px 6px 0 6px;">
                <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;" class="mini muted">
                  You’re receiving this because you triggered a Sniper action in HirePilot.<br/>
                  {{company_address}} • <a href="{{unsubscribe_url}}" style="color:#a5b4fc;">Unsubscribe</a>
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const TEMPLATE_QUEUED_BULK = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Bulk Connect Queued</title>
  <style>
    html, body { margin:0 !important; padding:0 !important; width:100% !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    img { border:0; }
    a { text-decoration:none; }
    .wrap { width:100%; max-width:640px; margin:0 auto; }
    .card { background:#0f172a; border:1px solid rgba(148,163,184,0.18); border-radius:18px; }
    .text { color:#e2e8f0; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
    .muted { color:#94a3b8; }
    .h1 { font-size:22px; line-height:28px; font-weight:900; margin:0; }
    .p { margin:0; font-size:14px; line-height:20px; }
    .chip { display:inline-block; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:800;
      background:rgba(59,130,246,0.12); color:#60a5fa; border:1px solid rgba(59,130,246,0.22); }
    .btn { display:inline-block; padding:12px 16px; border-radius:12px;
      background:linear-gradient(135deg,#4f46e5,#8b5cf6); color:#fff !important; font-weight:800; font-size:14px; }
    .pill { padding:10px 12px; border-radius:14px; background:rgba(148,163,184,0.08); border:1px solid rgba(148,163,184,0.16); }
    .kpi { font-size:22px; font-weight:900; color:#e2e8f0; }
    .mini { font-size:12px; line-height:18px; }
  </style>
</head>
<body style="background:#0b1020;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" class="wrap" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding:0 0 14px 0;">
              <table role="presentation" width="100%">
                <tr>
                  <td class="text" style="padding:0 6px;">
                    <div style="display:inline-block; padding:10px 12px; border-radius:14px; background:rgba(79,70,229,0.15); border:1px solid rgba(99,102,241,0.25);">
                      <span style="font-weight:900; font-size:13px; color:#c7d2fe;">HirePilot</span>
                      <span style="font-weight:800; font-size:13px; color:#94a3b8;"> • Sniper</span>
                    </div>
                  </td>
                  <td align="right" class="text" style="padding:0 6px;">
                    <span class="chip">BULK QUEUED</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="card" style="padding:22px;">
              <div class="text">
                <p class="h1">Bulk connection requests queued 🚀</p>
                <p class="p muted" style="margin-top:8px;">
                  We’ll process your batch over time using your Sniper throttling rules (daily/hourly caps + active hours).
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td class="pill" style="width:33%; padding:14px;">
                      <div class="mini muted">Targets</div>
                      <div class="kpi">{{total_targets}}</div>
                    </td>
                    <td style="width:10px;"></td>
                    <td class="pill" style="width:33%; padding:14px;">
                      <div class="mini muted">Estimated pacing</div>
                      <div class="kpi">{{estimated_rate}}</div>
                      <div class="mini muted">per hour</div>
                    </td>
                    <td style="width:10px;"></td>
                    <td class="pill" style="width:33%; padding:14px;">
                      <div class="mini muted">Job ID</div>
                      <div class="mini" style="color:#e2e8f0; font-weight:900; margin-top:6px;">{{job_id}}</div>
                    </td>
                  </tr>
                </table>

                {{#if note}}
                <div class="pill" style="margin-top:14px; padding:14px;">
                  <div style="font-weight:800;">Connection note</div>
                  <p class="p muted" style="margin-top:8px; white-space:pre-wrap;">{{note}}</p>
                </div>
                {{/if}}

                <div style="margin-top:18px;">
                  <a class="btn" href="{{activity_url}}" target="_blank" rel="noopener">Track Batch Progress</a>
                  <span style="display:inline-block; width:10px;"></span>
                  <a class="btn" style="background:rgba(148,163,184,0.10); border:1px solid rgba(148,163,184,0.18);" href="{{leads_url}}" target="_blank" rel="noopener">View Leads</a>
                </div>

                <p class="mini muted" style="margin-top:14px;">
                  You can safely close HirePilot — this runs in the background. We’ll email you when results land.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 6px 0 6px;">
              <div class="text mini muted">
                You’re receiving this because you queued a bulk Sniper action in HirePilot.<br/>
                {{company_address}} • <a href="{{unsubscribe_url}}" style="color:#a5b4fc;">Unsubscribe</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const TEMPLATE_COMPLETED_SINGLE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Connection Request Result</title>
  <style>
    html, body { margin:0 !important; padding:0 !important; width:100% !important; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    a { text-decoration:none; }
    .wrap{ width:100%; max-width:640px; margin:0 auto; }
    .card{ background:#0f172a; border:1px solid rgba(148,163,184,0.18); border-radius:18px; }
    .text{ color:#e2e8f0; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
    .muted{ color:#94a3b8; }
    .h1{ font-size:22px; line-height:28px; font-weight:900; margin:0; }
    .p{ margin:0; font-size:14px; line-height:20px; }
    .btn{ display:inline-block; padding:12px 16px; border-radius:12px; background:linear-gradient(135deg,#4f46e5,#8b5cf6); color:#fff !important; font-weight:900; font-size:14px; }
    .pill{ display:inline-block; padding:8px 12px; border-radius:999px; font-size:12px; font-weight:900; }
    .ok{ background:rgba(34,197,94,0.12); color:#22c55e; border:1px solid rgba(34,197,94,0.22); }
    .warn{ background:rgba(245,158,11,0.12); color:#fbbf24; border:1px solid rgba(245,158,11,0.22); }
    .bad{ background:rgba(239,68,68,0.12); color:#fb7185; border:1px solid rgba(239,68,68,0.22); }
    .box{ padding:14px; border-radius:14px; background:rgba(148,163,184,0.08); border:1px solid rgba(148,163,184,0.16); }
    .mini{ font-size:12px; line-height:18px; }
  </style>
</head>
<body style="background:#0b1020;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020;">
  <tr>
    <td align="center" style="padding:28px 14px;">
      <table role="presentation" class="wrap" cellspacing="0" cellpadding="0">
        <tr>
          <td class="card" style="padding:22px;">
            <div class="text">
              <p class="h1">Connection request completed</p>
              <p class="p muted" style="margin-top:8px;">
                Here’s what happened with your Sniper action.
              </p>

              <div class="box" style="margin-top:14px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <!-- status chip -->
                  {{#if (eq final_status "SENT")}}
                    <span class="pill ok">SENT ✅</span>
                  {{else if (eq final_status "ALREADY_PENDING")}}
                    <span class="pill warn">ALREADY PENDING ⏳</span>
                  {{else if (eq final_status "ALREADY_CONNECTED")}}
                    <span class="pill warn">ALREADY CONNECTED 🤝</span>
                  {{else if (eq final_status "AUTH_REQUIRED")}}
                    <span class="pill bad">AUTH REQUIRED 🔒</span>
                  {{else}}
                    <span class="pill bad">FAILED ❌</span>
                  {{/if}}
                </div>

                <p class="p muted" style="margin-top:10px;">
                  Target: <span style="color:#e2e8f0; font-weight:900;">{{lead_name}}</span><br/>
                  Profile: <span style="color:#cbd5e1;">{{profile_url}}</span><br/>
                  Job ID: <span style="color:#e2e8f0; font-weight:900;">{{job_id}}</span>
                </p>

                {{#if message}}
                <p class="p muted" style="margin-top:10px;">
                  Details: <span style="color:#e2e8f0; font-weight:800;">{{message}}</span>
                </p>
                {{/if}}
              </div>

              <div style="margin-top:16px;">
                <a class="btn" href="{{activity_url}}" target="_blank" rel="noopener">View Full Activity</a>
                <span style="display:inline-block; width:10px;"></span>
                <a class="btn" style="background:rgba(148,163,184,0.10); border:1px solid rgba(148,163,184,0.18);" href="{{lead_url}}" target="_blank" rel="noopener">Open Lead</a>
              </div>

              {{#if (eq final_status "AUTH_REQUIRED")}}
              <div class="box" style="margin-top:14px; border-color:rgba(239,68,68,0.25);">
                <div style="font-weight:900;">Action needed</div>
                <p class="p muted" style="margin-top:8px;">
                  Your LinkedIn cloud session needs to be reconnected. Open Sniper Settings and reconnect LinkedIn, then re-run the action.
                </p>
                <div style="margin-top:10px;">
                  <a class="btn" href="{{sniper_settings_url}}" target="_blank" rel="noopener">Reconnect LinkedIn</a>
                </div>
              </div>
              {{/if}}

              <p class="mini muted" style="margin-top:14px;">
                If you didn’t trigger this, reply to this email and we’ll investigate.
              </p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 6px 0 6px;">
            <div class="text mini muted">
              {{company_address}} • <a href="{{unsubscribe_url}}" style="color:#a5b4fc;">Unsubscribe</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

const TEMPLATE_COMPLETED_BULK = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Bulk Connect Results</title>
  <style>
    html, body { margin:0 !important; padding:0 !important; width:100% !important; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    a { text-decoration:none; }
    .wrap{ width:100%; max-width:640px; margin:0 auto; }
    .card{ background:#0f172a; border:1px solid rgba(148,163,184,0.18); border-radius:18px; }
    .text{ color:#e2e8f0; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
    .muted{ color:#94a3b8; }
    .h1{ font-size:22px; line-height:28px; font-weight:900; margin:0; }
    .p{ margin:0; font-size:14px; line-height:20px; }
    .btn{ display:inline-block; padding:12px 16px; border-radius:12px; background:linear-gradient(135deg,#4f46e5,#8b5cf6); color:#fff !important; font-weight:900; font-size:14px; }
    .pill{ padding:12px; border-radius:14px; background:rgba(148,163,184,0.08); border:1px solid rgba(148,163,184,0.16); }
    .kpi{ font-size:22px; font-weight:900; color:#e2e8f0; }
    .mini{ font-size:12px; line-height:18px; }
    .row{ border-top:1px solid rgba(148,163,184,0.14); }
  </style>
</head>
<body style="background:#0b1020;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020;">
  <tr>
    <td align="center" style="padding:28px 14px;">
      <table role="presentation" class="wrap" cellspacing="0" cellpadding="0">
        <tr>
          <td class="card" style="padding:22px;">
            <div class="text">
              <p class="h1">Bulk connect results are in 📬</p>
              <p class="p muted" style="margin-top:8px;">
                Your Sniper batch finished processing under your throttle rules. Here’s the summary.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                <tr>
                  <td class="pill" style="width:25%; padding:14px;">
                    <div class="mini muted">Sent</div>
                    <div class="kpi">{{sent_count}}</div>
                  </td>
                  <td style="width:10px;"></td>
                  <td class="pill" style="width:25%; padding:14px;">
                    <div class="mini muted">Already Pending</div>
                    <div class="kpi">{{already_pending_count}}</div>
                  </td>
                  <td style="width:10px;"></td>
                  <td class="pill" style="width:25%; padding:14px;">
                    <div class="mini muted">Already Connected</div>
                    <div class="kpi">{{already_connected_count}}</div>
                  </td>
                  <td style="width:10px;"></td>
                  <td class="pill" style="width:25%; padding:14px;">
                    <div class="mini muted">Failed</div>
                    <div class="kpi">{{failed_count}}</div>
                  </td>
                </tr>
              </table>

              <div class="pill" style="margin-top:12px; padding:14px;">
                <p class="p muted">
                  Job ID: <span style="color:#e2e8f0; font-weight:900;">{{job_id}}</span><br/>
                  Workspace: <span style="color:#e2e8f0; font-weight:900;">{{workspace_name}}</span><br/>
                  Total processed: <span style="color:#e2e8f0; font-weight:900;">{{processed_count}}</span> / {{total_targets}}
                </p>
              </div>

              {{#if auth_required}}
              <div class="pill" style="margin-top:12px; padding:14px; border-color:rgba(239,68,68,0.25);">
                <div style="font-weight:900;">Action needed: reconnect LinkedIn</div>
                <p class="p muted" style="margin-top:8px;">
                  We paused your batch because your LinkedIn cloud session needs to be reconnected. Reconnect in Sniper Settings, then resume.
                </p>
                <div style="margin-top:10px;">
                  <a class="btn" href="{{sniper_settings_url}}" target="_blank" rel="noopener">Reconnect LinkedIn</a>
                </div>
              </div>
              {{/if}}

              <div style="margin-top:16px;">
                <a class="btn" href="{{activity_url}}" target="_blank" rel="noopener">View Batch Activity</a>
                <span style="display:inline-block; width:10px;"></span>
                <a class="btn" style="background:rgba(148,163,184,0.10); border:1px solid rgba(148,163,184,0.18);" href="{{leads_url}}" target="_blank" rel="noopener">Open Leads</a>
              </div>

              {{#if top_fail_reasons}}
              <div class="pill" style="margin-top:14px; padding:14px;">
                <div style="font-weight:900;">Top fail reasons</div>
                <p class="p muted" style="margin-top:8px; white-space:pre-wrap;">{{top_fail_reasons}}</p>
              </div>
              {{/if}}

              <p class="mini muted" style="margin-top:14px;">
                Want higher reply rates? Pair this with a 3-touch email sequence in Messages Center.
              </p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 6px 0 6px;">
            <div class="text mini muted">
              {{company_address}} • <a href="{{unsubscribe_url}}" style="color:#a5b4fc;">Unsubscribe</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

function renderTemplate(html: string, vars: Record<string, string | null | undefined>) {
  return html.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

function renderIfBlock(html: string, key: string, include: boolean) {
  const re = new RegExp(`{{#if ${key}}}([\\s\\S]*?){{\\/if}}`, 'g');
  return html.replace(re, include ? '$1' : '');
}

function renderEqFinalStatusBlock(html: string, finalStatus: string) {
  const re = /{{#if \(eq final_status "AUTH_REQUIRED"\)}}([\s\S]*?){{\/if}}/g;
  return html.replace(re, finalStatus === 'AUTH_REQUIRED' ? '$1' : '');
}

function renderStatusChipBlock(html: string, finalStatus: string) {
  const re = /{{#if \(eq final_status "SENT"\)}}[\s\S]*?{{\/if}}/g;
  return html.replace(re, buildStatusChip(finalStatus));
}

function formatStatus(finalStatus: string): { label: string; className: string; emoji: string; message: string } {
  const normalized = String(finalStatus || '').toUpperCase();
  if (normalized === 'SENT') return { label: 'SENT', className: 'ok', emoji: '✅', message: 'Connection request sent.' };
  if (normalized === 'ALREADY_PENDING') return { label: 'ALREADY PENDING', className: 'warn', emoji: '⏳', message: 'Already pending on LinkedIn.' };
  if (normalized === 'ALREADY_CONNECTED') return { label: 'ALREADY CONNECTED', className: 'warn', emoji: '🤝', message: 'Already connected on LinkedIn.' };
  if (normalized === 'AUTH_REQUIRED') return { label: 'AUTH REQUIRED', className: 'bad', emoji: '🔒', message: 'LinkedIn auth is required.' };
  return { label: 'FAILED', className: 'bad', emoji: '❌', message: 'Request failed.' };
}

function buildStatusChip(finalStatus: string) {
  const meta = formatStatus(finalStatus);
  return `<span class="pill ${meta.className}">${meta.label} ${meta.emoji}</span>`;
}

function getFrontendBase(): string {
  const raw =
    (process.env.FRONTEND_BASE_URL || '').trim() ||
    (process.env.FRONTEND_URL || '').trim() ||
    (process.env.NEXT_PUBLIC_APP_URL || '').trim() ||
    'https://app.thehirepilot.com';
  return raw.replace(/\/$/, '');
}

function getCompanyAddress(): string {
  return String(process.env.COMPANY_ADDRESS || process.env.SENDGRID_COMPANY_ADDRESS || 'HirePilot').trim();
}

async function fetchWorkspaceName(workspaceId: string): Promise<string> {
  try {
    const { data } = await sniperSupabaseDb.from('teams').select('name').eq('id', workspaceId).maybeSingle();
    return (data as any)?.name || 'Workspace';
  } catch {
    return 'Workspace';
  }
}

async function fetchLeadForProfileUrl(workspaceId: string, profileUrl: string): Promise<{ name: string; id: string | null }> {
  try {
    const { data } = await sniperSupabaseDb
      .from('leads')
      .select('id, full_name, first_name, last_name')
      .eq('workspace_id', workspaceId)
      .eq('linkedin_url', profileUrl)
      .maybeSingle();
    const row: any = data;
    if (!row) return { name: 'LinkedIn profile', id: null };
    const name =
      String(row.full_name || '').trim() ||
      String([row.first_name, row.last_name].filter(Boolean).join(' ')).trim() ||
      'LinkedIn profile';
    return { name, id: row.id ? String(row.id) : null };
  } catch {
    return { name: 'LinkedIn profile', id: null };
  }
}

async function fetchUserNotificationSettings(userId: string): Promise<UserNotificationSettings> {
  const [{ data: user }, { data: settings }] = await Promise.all([
    sniperSupabaseDb.from('users').select('email, first_name').eq('id', String(userId)).maybeSingle(),
    sniperSupabaseDb.from('user_settings').select('email_notifications,email,slack_notifications,campaign_updates,slack_webhook_url').eq('user_id', String(userId)).maybeSingle()
  ]);

  const toEmail = String((settings as any)?.email || (user as any)?.email || '').trim();
  const firstName = String((user as any)?.first_name || '').trim() || 'there';
  const emailAllowed = Boolean((settings as any)?.email_notifications);
  const slackAllowed = Boolean((settings as any)?.slack_notifications ?? (settings as any)?.campaign_updates);
  const slackWebhook = String((settings as any)?.slack_webhook_url || process.env.SLACK_WEBHOOK_URL || '').trim();

  return { emailAllowed, slackAllowed, toEmail, firstName, slackWebhook };
}

async function sendSlack(webhookUrl: string, text: string) {
  if (!webhookUrl) return;
  await axios.post(webhookUrl, {
    text,
    username: 'HirePilot',
    icon_emoji: ':robot_face:'
  });
}

function baseLinks(jobId: string) {
  const frontendBase = getFrontendBase();
  return {
    activityUrl: `${frontendBase}/sniper/activity?job=${encodeURIComponent(jobId)}`,
    leadsUrl: `${frontendBase}/leads`,
    leadUrl: `${frontendBase}/leads`,
    settingsUrl: `${frontendBase}/sniper/settings`,
    unsubscribeUrl: `${frontendBase}/settings/notifications`
  };
}

export async function notifyConnectQueued(args: QueueNotificationArgs) {
  try {
    const settings = await fetchUserNotificationSettings(args.userId);
    const workspaceName = await fetchWorkspaceName(args.workspaceId);
    const links = baseLinks(args.jobId);
    const lead = args.profileUrl ? await fetchLeadForProfileUrl(args.workspaceId, args.profileUrl) : { name: 'LinkedIn profile', id: null };
    const leadUrl = lead.id ? `${links.leadUrl}?lead_id=${encodeURIComponent(lead.id)}` : links.leadUrl;

    const vars = {
      workspace_name: workspaceName,
      job_id: args.jobId,
      activity_url: links.activityUrl,
      leads_url: links.leadsUrl,
      lead_url: leadUrl,
      lead_name: lead.name,
      profile_url: args.profileUrl || 'LinkedIn profile',
      note: args.note || '',
      total_targets: String(args.totalTargets || 0),
      estimated_rate: String(args.estimatedRate || ''),
      sniper_settings_url: links.settingsUrl,
      company_address: getCompanyAddress(),
      unsubscribe_url: links.unsubscribeUrl
    };

    if (settings.emailAllowed && settings.toEmail) {
      const fromEmail = (process.env.SENDGRID_FROM_EMAIL || '').trim() || 'noreply@hirepilot.com';
      const fromName = (process.env.SENDGRID_FROM_NAME || '').trim() || 'HirePilot';
      const from = `${fromName} <${fromEmail}>`;
      const subject = args.isBulk
        ? `Queued: Bulk LinkedIn connect to ${vars.total_targets} targets`
        : `Queued: LinkedIn connection request to ${vars.lead_name}`;
      let html = args.isBulk ? TEMPLATE_QUEUED_BULK : TEMPLATE_QUEUED_SINGLE;
      html = renderIfBlock(html, 'note', Boolean(args.note));
      html = renderTemplate(html, vars as any);
      await sendgridSend({ from, to: settings.toEmail, subject, html });
    }

    if (settings.slackAllowed && settings.slackWebhook) {
      const baseText = args.isBulk
        ? `📥 Bulk LinkedIn connect queued (${args.totalTargets} targets). Job ${args.jobId}.`
        : `📥 LinkedIn connect queued for ${vars.lead_name}. Job ${args.jobId}.`;
      const slackText = `${baseText}\n${links.activityUrl}`;
      await sendSlack(settings.slackWebhook, slackText);
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('[sniper.connect.notify] queued notification failed (non-fatal):', e?.message || e);
  }
}

export async function notifyConnectResult(args: ResultNotificationArgs) {
  try {
    const settings = await fetchUserNotificationSettings(args.userId);
    const workspaceName = await fetchWorkspaceName(args.workspaceId);
    const links = baseLinks(args.jobId);
    const lead = await fetchLeadForProfileUrl(args.workspaceId, args.profileUrl);
    const leadUrl = lead.id ? `${links.leadUrl}?lead_id=${encodeURIComponent(lead.id)}` : links.leadUrl;
    const statusMeta = formatStatus(args.finalStatus);

    const vars = {
      workspace_name: workspaceName,
      job_id: args.jobId,
      activity_url: links.activityUrl,
      lead_url: leadUrl,
      lead_name: lead.name,
      profile_url: args.profileUrl,
      final_status: String(args.finalStatus || ''),
      message: args.message || statusMeta.message,
      note: args.note || '',
      sniper_settings_url: links.settingsUrl,
      company_address: getCompanyAddress(),
      unsubscribe_url: links.unsubscribeUrl
    };

    const isSuccess = ['SENT', 'ALREADY_PENDING', 'ALREADY_CONNECTED'].includes(String(args.finalStatus || '').toUpperCase());
    if (settings.emailAllowed && settings.toEmail && isSuccess) {
      const fromEmail = (process.env.SENDGRID_FROM_EMAIL || '').trim() || 'noreply@hirepilot.com';
      const fromName = (process.env.SENDGRID_FROM_NAME || '').trim() || 'HirePilot';
      const from = `${fromName} <${fromEmail}>`;
      const subject = `Result: LinkedIn connect to ${vars.lead_name} → ${vars.final_status}`;
      let html = TEMPLATE_COMPLETED_SINGLE;
      html = renderStatusChipBlock(html, vars.final_status);
      html = renderEqFinalStatusBlock(html, vars.final_status);
      html = renderIfBlock(html, 'message', Boolean(vars.message));
      html = renderTemplate(html, vars as any);
      await sendgridSend({ from, to: settings.toEmail, subject, html });
    }

    if (settings.slackAllowed && settings.slackWebhook && isSuccess) {
      const slackText = `✅ LinkedIn connect ${statusMeta.label.toLowerCase()} for ${lead.name}. Job ${args.jobId}.\n${links.activityUrl}`;
      await sendSlack(settings.slackWebhook, slackText);
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('[sniper.connect.notify] result notification failed (non-fatal):', e?.message || e);
  }
}

type BulkSummary = {
  sentCount: number;
  alreadyPendingCount: number;
  alreadyConnectedCount: number;
  failedCount: number;
  processedCount: number;
  totalTargets: number;
  authRequired: boolean;
  topFailReasons?: string;
};

async function summarizeConnectJob(jobId: string): Promise<BulkSummary> {
  const { data, error } = await sniperSupabaseDb
    .from('sniper_job_items')
    .select('status,error_message,error_code')
    .eq('job_id', jobId);
  if (error) throw error;
  const rows = (data || []) as any[];
  const total = rows.length;
  const sentCount = rows.filter((r) => r.status === 'succeeded_verified').length;
  const alreadyPendingCount = rows.filter((r) => r.status === 'succeeded_noop_already_pending').length;
  const alreadyConnectedCount = rows.filter((r) => r.status === 'succeeded_noop_already_connected').length;
  const failedCount = rows.filter((r) => String(r.status || '').startsWith('failed') || r.status === 'failed').length;
  const processedCount = rows.filter((r) => r.status !== 'queued' && r.status !== 'running').length;
  const authRequired = rows.some((r) => r.status === 'paused_cooldown' || r.error_code === 'auth_required');
  const reasons: Record<string, number> = {};
  rows
    .filter((r) => String(r.status || '').startsWith('failed') || r.status === 'failed')
    .forEach((r) => {
      const msg = String(r.error_message || '').trim();
      if (!msg) return;
      reasons[msg] = (reasons[msg] || 0) + 1;
    });
  const topFailReasons = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason} (${count})`)
    .join('\n');
  return {
    sentCount,
    alreadyPendingCount,
    alreadyConnectedCount,
    failedCount,
    processedCount,
    totalTargets: total,
    authRequired,
    topFailReasons: topFailReasons || ''
  };
}

export async function notifyConnectBulkSummary(jobId: string, userId: string, workspaceId: string) {
  try {
    const nowIso = new Date().toISOString();
    const { data: claimed, error: claimErr } = await sniperSupabaseDb
      .from('sniper_jobs')
      .update({ notified_at: nowIso })
      .eq('id', jobId)
      .is('notified_at', null)
      .select('id')
      .maybeSingle();
    if (claimErr) throw claimErr;
    if (!claimed) return;

    const settings = await fetchUserNotificationSettings(userId);
    const workspaceName = await fetchWorkspaceName(workspaceId);
    const links = baseLinks(jobId);
    const summary = await summarizeConnectJob(jobId);
    if (summary.totalTargets <= 1) return;

    const vars = {
      workspace_name: workspaceName,
      job_id: jobId,
      activity_url: links.activityUrl,
      leads_url: links.leadsUrl,
      sniper_settings_url: links.settingsUrl,
      company_address: getCompanyAddress(),
      unsubscribe_url: links.unsubscribeUrl,
      sent_count: String(summary.sentCount),
      already_pending_count: String(summary.alreadyPendingCount),
      already_connected_count: String(summary.alreadyConnectedCount),
      failed_count: String(summary.failedCount),
      processed_count: String(summary.processedCount),
      total_targets: String(summary.totalTargets),
      auth_required: summary.authRequired ? 'true' : '',
      top_fail_reasons: summary.topFailReasons || ''
    };

    if (settings.emailAllowed && settings.toEmail) {
      const fromEmail = (process.env.SENDGRID_FROM_EMAIL || '').trim() || 'noreply@hirepilot.com';
      const fromName = (process.env.SENDGRID_FROM_NAME || '').trim() || 'HirePilot';
      const from = `${fromName} <${fromEmail}>`;
      const subject = `Completed: Bulk LinkedIn connect — ${vars.sent_count} sent, ${vars.failed_count} failed`;
      let html = TEMPLATE_COMPLETED_BULK;
      html = renderIfBlock(html, 'auth_required', summary.authRequired);
      html = renderIfBlock(html, 'top_fail_reasons', Boolean(summary.topFailReasons));
      html = renderTemplate(html, vars as any);
      await sendgridSend({ from, to: settings.toEmail, subject, html });
    }

    if (settings.slackAllowed && settings.slackWebhook) {
      const slackText = `✅ Bulk LinkedIn connect completed. Sent ${summary.sentCount}, failed ${summary.failedCount}. Job ${jobId}.\n${links.activityUrl}`;
      await sendSlack(settings.slackWebhook, slackText);
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('[sniper.connect.notify] bulk summary failed (non-fatal):', e?.message || e);
  }
}

