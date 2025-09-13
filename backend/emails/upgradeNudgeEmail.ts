export const upgradeNudgeEmail = (firstName: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Unlock More with HirePilot</title>
    <style>
      body { font-family: sans-serif; background: #f9f9f9; padding: 40px; color: #333; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; }
      .btn { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin-top: 24px; }
      .subtle { color: #666; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Ready to unlock more power, ${firstName}?</h1>
      <p>Your free tools are working hard — but there’s more waiting for you:</p>
      <ul>
        <li>🚀 Higher campaign limits</li>
        <li>🤖 Full REX Agent automations</li>
        <li>🧩 Integrations with Zapier, Make, and CRMs</li>
        <li>📬 Extra credits for enrichment + LinkedIn connects</li>
      </ul>
      <a href="https://thehirepilot.com/pricing" class="btn">Compare Paid Plans</a>
      <p class="subtle">Upgrading won’t remove your data — it just unlocks more power.</p>
    </div>
  </body>
  </html>
`;


