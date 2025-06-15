import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY environment variable is not set');
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function testSendGrid() {
  try {
    const msg = {
      to: 'test@example.com',
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@hirepilot.com',
      subject: 'Test Email',
      text: 'This is a test email from HirePilot',
      html: '<p>This is a test email from HirePilot</p>',
    };

    await sgMail.send(msg);
    console.log('Test email sent successfully');
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testSendGrid().catch(console.error);
} 