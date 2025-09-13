export const welcomeEmail = (firstName: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to HirePilot</title>
    <style>
      body { font-family: sans-serif; background: #f9f9f9; padding: 40px; color: #333; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; }
      .btn { display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; margin-top: 24px; }
      .subtle { color: #666; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Welcome to HirePilot, ${firstName} 👋</h1>
      <p>We’re so glad you’re here. Your <strong>Free Forever</strong> account is now active and ready to help you source, contact, and convert top talent.</p>
      <ul>
        <li>✅ Send email campaigns with REX</li>
        <li>✅ Capture LinkedIn leads via Chrome Extension</li>
        <li>✅ Invite collaborators to your job reqs</li>
        <li>✅ Track replies and candidate flow</li>
      </ul>
      <a href="https://thehirepilot.com/freeforever" class="btn">Explore Your Free Plan</a>
      <p class="subtle">Need help? Just reply to this email — we’re real humans.</p>
    </div>
  </body>
  </html>
`;


