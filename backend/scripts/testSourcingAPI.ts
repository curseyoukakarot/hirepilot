import axios from 'axios';
import 'dotenv/config';

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const API_URL = `${BASE_URL}/api/sourcing`;

// Mock auth token - in real usage this would come from authentication
const AUTH_TOKEN = 'test-token';

async function testSourcingAPI() {
  console.log('🧪 Testing Sourcing API endpoints...\n');
  
  try {
    // Test 1: Create campaign
    console.log('1️⃣ Creating campaign...');
    const campaignResponse = await axios.post(`${API_URL}/campaigns`, {
      title: 'Test Sourcing Campaign',
      audience_tag: 'software-engineers',
      product_name: 'HirePilot'
    }, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    const campaignId = campaignResponse.data.id;
    console.log(`✅ Campaign created: ${campaignId}\n`);
    
    // Test 2: Generate sequence
    console.log('2️⃣ Generating email sequence...');
    const sequenceResponse = await axios.post(`${API_URL}/campaigns/${campaignId}/sequence`, {
      title_groups: ['Software Engineer', 'Full Stack Developer'],
      industry: 'Technology',
      product_name: 'HirePilot',
      spacing_business_days: 2
    }, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('✅ Sequence generated:', sequenceResponse.data.steps_json);
    console.log('');
    
    // Test 3: Add leads
    console.log('3️⃣ Adding leads...');
    const leadsResponse = await axios.post(`${API_URL}/campaigns/${campaignId}/leads`, {
      leads: [
        {
          name: 'John Doe',
          title: 'Software Engineer',
          company: 'Tech Corp',
          email: 'john@techcorp.com',
          linkedin_url: 'https://linkedin.com/in/johndoe'
        },
        {
          name: 'Jane Smith',
          title: 'Full Stack Developer',
          company: 'StartupXYZ',
          email: 'jane@startupxyz.com'
        }
      ]
    }, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log(`✅ Added ${leadsResponse.data.inserted} leads\n`);
    
    // Test 4: Get campaign details
    console.log('4️⃣ Fetching campaign details...');
    const detailsResponse = await axios.get(`${API_URL}/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('✅ Campaign details:', {
      title: detailsResponse.data.title,
      status: detailsResponse.data.status,
      stats: detailsResponse.data.stats
    });
    console.log('');
    
    // Test 5: Get campaigns list
    console.log('5️⃣ Fetching campaigns list...');
    const listResponse = await axios.get(`${API_URL}/campaigns`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log(`✅ Found ${listResponse.data.campaigns.length} campaigns\n`);
    
    // Test 6: Get email senders
    console.log('6️⃣ Fetching email senders...');
    const sendersResponse = await axios.get(`${API_URL}/senders`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log(`✅ Found ${sendersResponse.data.length} email senders\n`);
    
    console.log('🎉 All API tests passed!');
    
  } catch (error: any) {
    console.error('❌ API test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  testSourcingAPI();
}

export { testSourcingAPI };
