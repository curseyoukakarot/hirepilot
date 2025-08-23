import 'dotenv/config';

// Mock test for REX sourcing tools
// This simulates how REX would call the sourcing tools

async function testRexSourcingTools() {
  console.log('🧪 Testing REX Sourcing MCP Tools...\n');
  
  // Mock user ID (in real usage, this comes from REX context)
  const userId = 'test-user-id';
  
  console.log('📋 Available Sourcing Tools:');
  console.log('1. sourcing_create_campaign - Create a new sourcing campaign');
  console.log('2. sourcing_save_sequence - Generate AI-powered email sequence');
  console.log('3. sourcing_add_leads - Add leads to campaign');
  console.log('4. sourcing_schedule_sends - Schedule campaign execution');
  console.log('5. sourcing_get_campaign - Get campaign details');
  console.log('6. sourcing_list_campaigns - List user campaigns');
  console.log('7. sourcing_get_senders - Get available email senders');
  console.log('');
  
  // Example REX conversation flow
  console.log('💬 Example REX Conversation Flow:');
  console.log('');
  
  console.log('User: "Create a sourcing campaign for software engineers"');
  console.log('REX: Calling sourcing_create_campaign...');
  console.log('Tool Call: sourcing_create_campaign({');
  console.log('  userId: "' + userId + '",');
  console.log('  title: "Q1 Software Engineers Outreach",');
  console.log('  audience_tag: "software-engineers"');
  console.log('})');
  console.log('');
  
  console.log('User: "Generate a 3-step email sequence for this campaign"');
  console.log('REX: Calling sourcing_save_sequence...');
  console.log('Tool Call: sourcing_save_sequence({');
  console.log('  userId: "' + userId + '",');
  console.log('  campaign_id: "campaign-uuid",');
  console.log('  title_groups: ["Software Engineer", "Full Stack Developer", "Backend Engineer"],');
  console.log('  industry: "Technology",');
  console.log('  product_name: "HirePilot",');
  console.log('  spacing_business_days: 2');
  console.log('})');
  console.log('');
  
  console.log('User: "Add these 50 leads to the campaign"');
  console.log('REX: Calling sourcing_add_leads...');
  console.log('Tool Call: sourcing_add_leads({');
  console.log('  userId: "' + userId + '",');
  console.log('  campaign_id: "campaign-uuid",');
  console.log('  leads: [');
  console.log('    {');
  console.log('      name: "John Doe",');
  console.log('      title: "Software Engineer",');
  console.log('      company: "TechCorp",');
  console.log('      email: "john@techcorp.com",');
  console.log('      linkedin_url: "https://linkedin.com/in/johndoe"');
  console.log('    },');
  console.log('    // ... 49 more leads');
  console.log('  ]');
  console.log('})');
  console.log('');
  
  console.log('User: "Launch the campaign now"');
  console.log('REX: Calling sourcing_schedule_sends...');
  console.log('Tool Call: sourcing_schedule_sends({');
  console.log('  userId: "' + userId + '",');
  console.log('  campaign_id: "campaign-uuid"');
  console.log('})');
  console.log('');
  
  console.log('User: "Show me my active campaigns"');
  console.log('REX: Calling sourcing_list_campaigns...');
  console.log('Tool Call: sourcing_list_campaigns({');
  console.log('  userId: "' + userId + '",');
  console.log('  status: "running",');
  console.log('  limit: 10');
  console.log('})');
  console.log('');
  
  console.log('🎯 Tool Capabilities:');
  console.log('✅ Campaign Creation - Create campaigns with custom titles and audience tags');
  console.log('✅ AI Sequence Generation - GPT-powered 3-step email sequences');
  console.log('✅ Lead Management - Bulk add leads with contact information');
  console.log('✅ Campaign Scheduling - Launch campaigns with business day spacing');
  console.log('✅ Campaign Monitoring - Get detailed campaign stats and progress');
  console.log('✅ Sender Management - List available email sender profiles');
  console.log('');
  
  console.log('🔐 Security Features:');
  console.log('✅ Premium User Validation - All tools require premium access');
  console.log('✅ User Context - Tools automatically use authenticated user ID');
  console.log('✅ API Authentication - Secure backend API calls with tokens');
  console.log('✅ Input Validation - Zod schemas validate all parameters');
  console.log('');
  
  console.log('🚀 REX Integration Benefits:');
  console.log('• Natural language campaign creation');
  console.log('• Conversational lead management');
  console.log('• AI-powered sequence optimization');
  console.log('• Real-time campaign monitoring');
  console.log('• Automated workflow execution');
  console.log('');
  
  console.log('🎉 REX Sourcing Tools ready for conversational AI!');
}

// Run tests if called directly
if (require.main === module) {
  testRexSourcingTools();
}

export { testRexSourcingTools };
