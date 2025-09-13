export const activationPushEmail = (firstName: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Turn Free Into First Placement</title>
    <style>
      body { font-family: sans-serif; background: #f9f9f9; padding: 40px; color: #333; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; }
      .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; margin-top: 24px; }
      .subtle { color: #666; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>This could be your first placement, ${firstName}</h1>
      <p>You’ve got the tools. Now let’s use them.</p>
      <ol>
        <li>📥 Add leads via Chrome Extension</li>
        <li>✉️ Generate outreach with REX</li>
        <li>⏱️ Schedule interviews faster</li>
      </ol>
      <p>Want more firepower?</p>
      <ul>
        <li>🔓 Unlock bulk sourcing</li>
        <li>📤 Use Zapier or Make for automations</li>
        <li>💬 Activate full REX automations</li>
      </ul>
      <a href="https://thehirepilot.com/pricing" class="btn">Upgrade & Scale</a>
      <p class="subtle">You’re closer than you think.</p>
    </div>
  </body>
  </html>
`;


