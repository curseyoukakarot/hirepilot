// backend/src/emails/tasksEmailTemplates.ts
/* eslint-disable @typescript-eslint/no-unused-vars */

export type TaskEmailBrand = {
  appName: string;              // "HirePilot"
  appUrl: string;              // "https://app.thehirepilot.com"
  logoUrl: string;              // hosted logo (cdn/supabase)
  accent: string;               // "#7C3AED" (example)
  supportEmail?: string;        // "support@thehirepilot.com"
  footerNote?: string;          // optional compliance text
};

export type TaskEmailCommon = {
  workspaceName?: string;       // "Offr Group"
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  taskStatus?: string | null;   // "Open" | "In Progress" etc.
  taskPriority?: string | null; // "Low/Medium/High/Urgent"
  dueAt?: string | null;        // already formatted string (e.g., "Fri, Mar 1 at 3:00 PM")
  relatedLabel?: string | null; // "Linked to: Senior Backend Engineer (Job Req)"
  relatedUrl?: string | null;   // deep link to the object
  taskUrl: string;              // deep link to /tasks?taskId=...
};

export type TaskAssignedEmailInput = TaskEmailCommon & {
  assigneeName: string;
  assignerName: string;
  assignerEmail?: string;
};

export type TaskCommentEmailInput = TaskEmailCommon & {
  assigneeName: string;
  commenterName: string;
  commentPreview: string;       // short (server should trim)
  commentUrl?: string | null;   // deep link to task activity
};

export type TaskCompletedEmailInput = TaskEmailCommon & {
  assigneeName: string;
  assignerName: string;
  completedAt?: string | null;  // formatted string
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(input: string, max = 180): string {
  const s = input.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function safe(input?: string | null): string {
  return input ? escapeHtml(input) : "";
}

function badge(label: string, bg: string, fg = "#E5E7EB"): string {
  return `
    <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${bg};color:${fg};
      font-size:12px;line-height:12px;font-weight:600;letter-spacing:.2px;margin-right:8px;">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderFrame(opts: {
  brand: TaskEmailBrand;
  preheader: string;
  headline: string;
  introHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  detailsHtml: string;
  activityHtml?: string;
}): { html: string; textBase: string } {
  const { brand } = opts;

  const accent = brand.accent || "#7C3AED";
  const appName = brand.appName || "HirePilot";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(appName)} — Task Update</title>
</head>
<body style="margin:0;padding:0;background:#0B1020;color:#E5E7EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(opts.preheader)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0B1020;padding:28px 14px;">
    <tr>
      <td align="center">

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;">
          <tr>
            <td style="padding:0 6px 14px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="padding:8px 0;">
                    <a href="${escapeHtml(brand.appUrl)}" style="text-decoration:none;">
                      <img src="${escapeHtml(brand.logoUrl)}" width="140" alt="${escapeHtml(appName)}" style="display:block;border:0;outline:none;" />
                    </a>
                  </td>
                  <td align="right" style="padding:8px 0;color:#94A3B8;font-size:12px;">
                    ${escapeHtml(appName)} Tasks
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                style="border-radius:18px;background:linear-gradient(180deg, rgba(124,58,237,.18), rgba(124,58,237,.06));
                       border:1px solid rgba(124,58,237,.22);">
                <tr>
                  <td style="padding:22px 22px 18px 22px;">
                    <div style="font-size:12px;color:#A78BFA;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">
                      Task Update
                    </div>
                    <div style="margin-top:10px;font-size:28px;line-height:1.15;font-weight:800;color:#F8FAFC;">
                      ${escapeHtml(opts.headline)}
                    </div>

                    <div style="margin-top:12px;font-size:15px;line-height:1.55;color:#CBD5E1;">
                      ${opts.introHtml}
                    </div>

                    <div style="margin-top:16px;">
                      <a href="${escapeHtml(opts.ctaUrl)}"
                         style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;
                                padding:12px 16px;border-radius:12px;font-weight:800;font-size:14px;">
                        ${escapeHtml(opts.ctaLabel)} →
                      </a>
                    </div>

                    <div style="margin-top:18px;border-top:1px solid rgba(148,163,184,.18);padding-top:16px;">
                      ${opts.detailsHtml}
                    </div>

                    ${opts.activityHtml ? `
                      <div style="margin-top:16px;border-top:1px solid rgba(148,163,184,.18);padding-top:16px;">
                        ${opts.activityHtml}
                      </div>
                    ` : ""}

                    <div style="margin-top:18px;color:#94A3B8;font-size:12px;line-height:1.6;">
                      If the button doesn't work, paste this link into your browser:<br/>
                      <a href="${escapeHtml(opts.ctaUrl)}" style="color:#A78BFA;text-decoration:none;word-break:break-all;">
                        ${escapeHtml(opts.ctaUrl)}
                      </a>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="padding:14px 8px 0 8px;color:#64748B;font-size:12px;line-height:1.6;text-align:center;">
                ${brand.supportEmail ? `Questions? <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:#A78BFA;text-decoration:none;">${escapeHtml(brand.supportEmail)}</a> · ` : ""}
                <a href="${escapeHtml(brand.appUrl)}" style="color:#A78BFA;text-decoration:none;">Open ${escapeHtml(appName)}</a>
                ${brand.footerNote ? `<div style="margin-top:10px;color:#475569;">${escapeHtml(brand.footerNote)}</div>` : ""}
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  const textBase = `${appName} — Task Update\n\n${opts.headline}\n\n`;
  return { html, textBase };
}

function renderTaskDetails(common: TaskEmailCommon): { detailsHtml: string; detailsText: string } {
  const lines: string[] = [];

  const status = common.taskStatus ? badge(`Status: ${common.taskStatus}`, "rgba(59,130,246,.18)") : "";
  const priority = common.taskPriority ? badge(`Priority: ${common.taskPriority}`, "rgba(245,158,11,.18)") : "";
  const due = common.dueAt ? badge(`Due: ${common.dueAt}`, "rgba(16,185,129,.14)") : "";
  const workspace = common.workspaceName ? badge(common.workspaceName, "rgba(148,163,184,.14)", "#E2E8F0") : "";

  const relatedBlock = common.relatedLabel
    ? `<div style="margin-top:10px;font-size:13px;color:#A5B4FC;">
         ${escapeHtml(common.relatedLabel)}
         ${common.relatedUrl ? ` · <a href="${escapeHtml(common.relatedUrl)}" style="color:#A78BFA;text-decoration:none;">Open</a>` : ""}
       </div>`
    : "";

  const descriptionBlock = common.taskDescription
    ? `<div style="margin-top:12px;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.18);
              border-radius:14px;padding:12px 12px;">
         <div style="color:#94A3B8;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Description</div>
         <div style="margin-top:8px;color:#E2E8F0;font-size:14px;line-height:1.55;white-space:pre-wrap;">
           ${safe(common.taskDescription)}
         </div>
       </div>`
    : "";

  const detailsHtml = `
    <div style="font-size:12px;color:#94A3B8;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">
      Task
    </div>
    <div style="margin-top:10px;font-size:18px;font-weight:900;color:#F1F5F9;">
      ${escapeHtml(common.taskTitle)}
    </div>

    <div style="margin-top:12px;">
      ${workspace}${status}${priority}${due}
    </div>

    ${relatedBlock}
    ${descriptionBlock}
  `;

  if (common.workspaceName) lines.push(`Workspace: ${common.workspaceName}`);
  lines.push(`Task: ${common.taskTitle}`);
  if (common.taskStatus) lines.push(`Status: ${common.taskStatus}`);
  if (common.taskPriority) lines.push(`Priority: ${common.taskPriority}`);
  if (common.dueAt) lines.push(`Due: ${common.dueAt}`);
  if (common.relatedLabel) lines.push(`${common.relatedLabel}${common.relatedUrl ? ` (${common.relatedUrl})` : ""}`);
  if (common.taskDescription) lines.push(`\nDescription:\n${common.taskDescription}`);

  return { detailsHtml, detailsText: lines.join("\n") };
}

/**
 * 1) Assigned email
 */
export function renderTaskAssignedEmail(
  brand: TaskEmailBrand,
  input: TaskAssignedEmailInput
): RenderedEmail {
  const { detailsHtml, detailsText } = renderTaskDetails(input);

  const headline = `You've been assigned a task`;
  const preheader = `${input.assignerName} assigned: ${input.taskTitle}${input.dueAt ? ` · Due ${input.dueAt}` : ""}`;
  const introHtml = `
    <div>
      <strong style="color:#F8FAFC;">${escapeHtml(input.assignerName)}</strong> assigned you a task in
      <strong style="color:#F8FAFC;">${escapeHtml(brand.appName)}</strong>.
    </div>
  `;

  const { html, textBase } = renderFrame({
    brand,
    preheader,
    headline,
    introHtml,
    ctaLabel: "View task",
    ctaUrl: input.taskUrl,
    detailsHtml,
  });

  const subject = `✅ Task assigned: ${truncate(input.taskTitle, 60)}`;
  const text = `${textBase}${preheader}\n\n${detailsText}\n\nOpen task: ${input.taskUrl}\n`;

  return { subject, html, text };
}

/**
 * 2) Comment on assigned task (with preview)
 */
export function renderTaskCommentEmail(
  brand: TaskEmailBrand,
  input: TaskCommentEmailInput
): RenderedEmail {
  const { detailsHtml, detailsText } = renderTaskDetails(input);

  const headline = `New comment on your task`;
  const preheader = `${input.commenterName}: ${truncate(input.commentPreview, 72)}`;
  const introHtml = `
    <div>
      <strong style="color:#F8FAFC;">${escapeHtml(input.commenterName)}</strong> commented on your task.
    </div>
  `;

  const activityHtml = `
    <div style="font-size:12px;color:#94A3B8;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">
      Comment preview
    </div>
    <div style="margin-top:10px;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.18);
                border-radius:14px;padding:12px 12px;">
      <div style="color:#E2E8F0;font-size:14px;line-height:1.55;white-space:pre-wrap;">
        ${safe(input.commentPreview)}
      </div>
    </div>
  `;

  const ctaUrl = input.commentUrl || input.taskUrl;

  const { html, textBase } = renderFrame({
    brand,
    preheader,
    headline,
    introHtml,
    ctaLabel: "Reply in task",
    ctaUrl,
    detailsHtml,
    activityHtml,
  });

  const subject = `💬 Comment on task: ${truncate(input.taskTitle, 60)}`;
  const text = `${textBase}${preheader}\n\n${detailsText}\n\nComment:\n${input.commentPreview}\n\nOpen: ${ctaUrl}\n`;

  return { subject, html, text };
}

/**
 * 3) Task completed (send to BOTH assigner and assignee)
 */
export function renderTaskCompletedEmail(
  brand: TaskEmailBrand,
  input: TaskCompletedEmailInput
): RenderedEmail {
  const { detailsHtml, detailsText } = renderTaskDetails({
    ...input,
    taskStatus: input.taskStatus || "Completed",
  });

  const headline = `Task completed`;
  const preheader = `${input.assigneeName} completed: ${input.taskTitle}${input.completedAt ? ` · ${input.completedAt}` : ""}`;

  const introHtml = `
    <div>
      <strong style="color:#F8FAFC;">${escapeHtml(input.assigneeName)}</strong> completed a task originally assigned by
      <strong style="color:#F8FAFC;">${escapeHtml(input.assignerName)}</strong>.
    </div>
  `;

  const activityHtml = `
    <div style="font-size:12px;color:#94A3B8;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">
      Completion
    </div>
    <div style="margin-top:10px;color:#E2E8F0;font-size:14px;line-height:1.55;">
      Status updated to <strong>Completed</strong>${input.completedAt ? ` on <strong>${escapeHtml(input.completedAt)}</strong>` : ""}.
    </div>
  `;

  const { html, textBase } = renderFrame({
    brand,
    preheader,
    headline,
    introHtml,
    ctaLabel: "View completed task",
    ctaUrl: input.taskUrl,
    detailsHtml,
    activityHtml,
  });

  const subject = `✅ Completed: ${truncate(input.taskTitle, 60)}`;
  const text = `${textBase}${preheader}\n\n${detailsText}\n\nOpen: ${input.taskUrl}\n`;

  return { subject, html, text };
}
