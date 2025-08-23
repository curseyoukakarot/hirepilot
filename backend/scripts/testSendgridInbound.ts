import axios from 'axios';
import 'dotenv/config';

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/sendgrid/sourcing/inbound`;

async function testSendgridInbound() {
  console.log('🧪 Testing SendGrid inbound webhook for sourcing...\n');
  
  try {
    // Mock SendGrid inbound payload
    const mockPayload = {
      headers: JSON.stringify({
        'X-Campaign-Id': '123e4567-e89b-12d3-a456-426614174000',
        'X-Lead-Id': '987fcdeb-51a2-43d1-b234-567890abcdef'
      }),
      from: 'john.doe@techcorp.com',
      to: 'campaigns@hirepilot.ai',
      subject: 'Re: Exciting opportunity at TechCorp',
      text: 'Hi there! Thanks for reaching out. I\'m definitely interested in learning more about this opportunity. When would be a good time to chat?',
      html: '<p>Hi there! Thanks for reaching out. I\'m definitely interested in learning more about this opportunity. When would be a good time to chat?</p>'
    };
    
    console.log('📧 Sending mock positive reply...');
    const response = await axios.post(WEBHOOK_URL, mockPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response:', response.data);
    console.log('');
    
    // Test negative reply
    const negativePayload = {
      ...mockPayload,
      from: 'jane.smith@startup.com',
      subject: 'Re: Partnership opportunity',
      text: 'Thanks for reaching out, but we\'re not interested at this time. Please remove me from your list.',
      headers: JSON.stringify({
        'X-Campaign-Id': '456e7890-e89b-12d3-a456-426614174111',
        'X-Lead-Id': '321fcdeb-51a2-43d1-b234-567890abcdef'
      })
    };
    
    console.log('📧 Sending mock negative reply...');
    const negativeResponse = await axios.post(WEBHOOK_URL, negativePayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response:', negativeResponse.data);
    console.log('');
    
    // Test auto-reply
    const autoPayload = {
      ...mockPayload,
      from: 'bob.wilson@company.com',
      subject: 'Out of Office Auto-Reply',
      text: 'Thank you for your email. I am currently out of the office and will return on Monday. I will respond to your message when I return.',
      headers: JSON.stringify({
        'X-Campaign-Id': '789e1234-e89b-12d3-a456-426614174222',
        'X-Lead-Id': '654fcdeb-51a2-43d1-b234-567890abcdef'
      })
    };
    
    console.log('📧 Sending mock auto-reply...');
    const autoResponse = await axios.post(WEBHOOK_URL, autoPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response:', autoResponse.data);
    console.log('');
    
    // Test missing headers
    const missingHeadersPayload = {
      from: 'test@example.com',
      to: 'campaigns@hirepilot.ai',
      subject: 'Test without headers',
      text: 'This email has no campaign/lead headers'
    };
    
    console.log('📧 Sending email without headers...');
    const missingResponse = await axios.post(WEBHOOK_URL, missingHeadersPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response:', missingResponse.data);
    console.log('');
    
    console.log('🎉 All SendGrid inbound tests completed!');
    
  } catch (error: any) {
    console.error('❌ SendGrid inbound test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  testSendgridInbound();
}

export { testSendgridInbound };
