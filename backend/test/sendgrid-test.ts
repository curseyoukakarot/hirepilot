import { sendTeamInviteEmail } from '../services/emailService';

async function testSendGridEmail() {
  try {
    console.log('Testing SendGrid email service...');

    // Send test email
    await sendTeamInviteEmail({
      to: 'brandon@offrgroup.com',
      firstName: 'Test',
      lastName: 'User',
      inviteLink: 'https://hirepilot.com/join?token=test-token',
      tempPassword: 'test-password',
      invitedBy: {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@hirepilot.com'
      },
      company: 'HirePilot',
      role: 'member'
    });

    console.log('✓ Test email sent successfully!');
  } catch (error: any) {
    console.error('✗ Error sending test email:', error);
    if (error.response?.body?.errors) {
      console.error('SendGrid errors:', error.response.body.errors);
    }
    process.exit(1);
  }
}

// Run the test
testSendGridEmail(); 