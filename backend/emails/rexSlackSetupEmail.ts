export const rexSlackSetupEmail = (firstName: string, appUrls: { commands: string; interactivity: string; events: string }) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Enable REX in your Slack Workspace</title>
    <style>
      body { margin:0; padding:0; background:#0f172a; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
      .wrap { max-width:640px; margin:0 auto; padding:32px 16px; }
      .card { background:#0b1220; border:1px solid #1e293b; border-radius:16px; padding:32px; color:#e2e8f0; }
      h1 { margin:0 0 12px; font-size:28px; color:#ffffff; }
      p { margin:12px 0; line-height:1.6; color:#cbd5e1; }
      .step { background:#0f172a; border:1px solid #23314d; border-radius:12px; padding:16px; margin:10px 0; }
      .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background:#0a0f1d; border:1px solid #22304b; color:#e2e8f0; padding:6px 10px; border-radius:8px; display:inline-block; }
      .btn { display:inline-block; background:#6d28d9; color:white; text-decoration:none; padding:12px 18px; border-radius:10px; margin-top:16px; }
      .note { font-size:13px; color:#94a3b8; }
      .kbd { padding:3px 6px; border:1px solid #334155; border-bottom-width:2px; border-radius:6px; background:#0b1220; color:#e2e8f0; }
      .divider { height:1px; background:#1f2937; margin:24px 0; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Connect REX to Slack</h1>
        <p>Hi ${firstName || 'there'}, great news — your REX Slack Integration is enabled. Follow these quick steps to add <strong>/rex</strong> to your Slack workspace.</p>

        <div class="step">
          <strong>1) Create the Slack App</strong>
          <p>Open <a href="https://api.slack.com/apps" style="color:#a78bfa">api.slack.com/apps</a> → <em>Create New App</em> → <em>From scratch</em>. Name it <em>HirePilot (REX)</em> and pick your workspace.</p>
        </div>

        <div class="step">
          <strong>2) Add the /rex command</strong>
          <p>Features → <em>Slash Commands</em> → <em>Create new command</em></p>
          <p>Command: <span class="code">/rex</span></p>
          <p>Request URL: <span class="code">${appUrls.commands}</span></p>
          <p>Usage hint: <span class="code">/rex link me</span></p>
        </div>

        <div class="step">
          <strong>3) Turn on Interactivity</strong>
          <p>Features → <em>Interactivity & Shortcuts</em> → Toggle ON</p>
          <p>Request URL: <span class="code">${appUrls.interactivity}</span></p>
        </div>

        <div class="step">
          <strong>4) (Optional) Enable @mentions</strong>
          <p>Features → <em>Event Subscriptions</em> → Toggle ON</p>
          <p>Request URL: <span class="code">${appUrls.events}</span></p>
          <p>Add bot event: <span class="code">app_mention</span></p>
        </div>

        <div class="step">
          <strong>5) Grant permissions</strong>
          <p>OAuth & Permissions → Bot Token Scopes → add:</p>
          <p><span class="code">commands</span> <span class="code">chat:write</span> <span class="code">channels:read</span> <span class="code">users:read</span></p>
          <p>Then click <em>Install to Workspace</em>.</p>
        </div>

        <div class="divider"></div>

        <p><strong>Try it:</strong> In any channel where the bot is invited, type <span class="code">/rex link me</span> then <span class="code">/rex hello</span>.</p>
        <a class="btn" href="https://api.slack.com/apps">Open Slack App Settings</a>
        <p class="note">Tip: invite the bot to a channel with <span class="kbd">/invite @YourBot</span>.</p>
      </div>
    </div>
  </body>
</html>`;


