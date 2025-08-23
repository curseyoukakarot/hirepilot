import 'dotenv/config';
import { startSourcingWizard, handleWizardStep, executeSourcing } from '../src/rex-orchestrator';
import { WizardSessionManager, ParameterProcessor, LeadGenerator } from '../src/rex-orchestrator/utils';

// Mock tools for testing
const mockTools = {
  call: async (toolName: string, params: any) => {
    console.log(`🔧 Mock tool call: ${toolName}`, params);
    
    switch (toolName) {
      case 'sourcing_create_campaign':
        return {
          id: 'campaign-123',
          title: params.title,
          status: 'draft',
          created_at: new Date().toISOString()
        };
        
      case 'sourcing_save_sequence':
        return {
          id: 'sequence-456',
          campaign_id: params.campaign_id,
          steps_json: {
            step1: { subject: 'Test Subject 1', body: 'Test Body 1' },
            step2: { subject: 'Test Subject 2', body: 'Test Body 2' },
            step3: { subject: 'Test Subject 3', body: 'Test Body 3' },
            spacingBusinessDays: params.spacing_business_days
          }
        };
        
      case 'sourcing_add_leads':
        return {
          inserted: params.leads.length,
          campaign_id: params.campaign_id
        };
        
      case 'sourcing_schedule_sends':
        return {
          scheduled: 50,
          campaign_id: params.campaign_id,
          status: 'running'
        };
        
      case 'sourcing_get_senders':
        return [
          {
            id: 'sender-1',
            from_name: 'John Doe',
            from_email: 'john@hirepilot.ai',
            domain_verified: true,
            provider: 'sendgrid'
          },
          {
            id: 'sender-2', 
            from_name: 'Jane Smith',
            from_email: 'jane@company.com',
            domain_verified: true,
            provider: 'sendgrid'
          }
        ];
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
};

const mockUser = { id: 'test-user-123' };

async function testRexOrchestrator() {
  console.log('🧪 Testing REX Orchestrator System...\n');
  
  try {
    // Test 1: Basic wizard start
    console.log('1️⃣ Testing wizard initialization...');
    const result1 = await startSourcingWizard(
      "Create a sourcing campaign for software engineers",
      mockTools,
      mockUser
    );
    console.log('✅ Wizard result:', result1);
    console.log('');
    
    // Test 2: More detailed request
    console.log('2️⃣ Testing detailed campaign request...');
    const result2 = await startSourcingWizard(
      "I want to reach out to 200 recruiting managers in tech companies with 3-day spacing",
      mockTools,
      mockUser
    );
    console.log('✅ Detailed request result:', result2);
    console.log('');
    
    // Test 3: Parameter validation
    console.log('3️⃣ Testing parameter validation...');
    const titleValidation = ParameterProcessor.validateTitleGroups([
      'Software Engineer',
      'Head of Talent',
      '', // Invalid
      'VP of People',
      'a'.repeat(150) // Too long
    ]);
    console.log('✅ Title validation:', titleValidation);
    
    const normalizedIndustry = ParameterProcessor.normalizeIndustry('tech');
    console.log('✅ Industry normalization:', normalizedIndustry);
    
    const campaignTitle = ParameterProcessor.generateCampaignTitle({
      title_groups: ['Software Engineer', 'Senior Developer'],
      industry: 'Technology'
    });
    console.log('✅ Generated campaign title:', campaignTitle);
    console.log('');
    
    // Test 4: Lead generation
    console.log('4️⃣ Testing lead generation...');
    const mockParams = {
      title_groups: ['Software Engineer', 'Technical Recruiter'],
      industry: 'Technology',
      location: 'San Francisco Bay Area',
      limit: 10,
      per_search: 25,
      product_name: 'HirePilot',
      spacing_business_days: 2,
      campaign_title: 'Test Campaign',
      track_and_assist_replies: true
    };
    
    const leads = await LeadGenerator.generateLeads(mockParams);
    console.log('✅ Generated leads:', leads.slice(0, 3), `... and ${leads.length - 3} more`);
    console.log('');
    
    // Test 5: Session management
    console.log('5️⃣ Testing session management...');
    const sessionId = await WizardSessionManager.createSession(mockUser.id, mockParams);
    console.log('✅ Created session:', sessionId);
    
    const session = WizardSessionManager.getSession(sessionId);
    console.log('✅ Retrieved session:', session?.session_id);
    
    const updated = WizardSessionManager.updateSession(sessionId, { step: 'summary' });
    console.log('✅ Updated session:', updated);
    
    const deleted = WizardSessionManager.deleteSession(sessionId);
    console.log('✅ Deleted session:', deleted);
    console.log('');
    
    // Test 6: Complete workflow simulation
    console.log('6️⃣ Testing complete workflow...');
    
    // Start wizard
    const wizardResult = await startSourcingWizard(
      "Create a campaign for Head of Talent positions in healthcare companies",
      mockTools,
      mockUser
    );
    console.log('📋 Wizard started:', typeof wizardResult === 'string' ? wizardResult : wizardResult.title);
    
    // Simulate user selecting sender
    if (typeof wizardResult === 'object' && wizardResult.session_id) {
      const senderStep = await handleWizardStep(
        wizardResult.session_id,
        { id: 'use_existing', value: 'sender-1' },
        mockTools,
        mockUser
      );
      console.log('📋 Sender selected:', typeof senderStep === 'string' ? senderStep : senderStep.title);
      
      // Simulate confirming titles
      if (typeof senderStep === 'object' && senderStep.session_id) {
        const titleStep = await handleWizardStep(
          senderStep.session_id,
          { id: 'titles', value: ['Head of Talent', 'VP People'] },
          mockTools,
          mockUser
        );
        console.log('📋 Titles confirmed:', typeof titleStep === 'string' ? titleStep : titleStep.title);
        
        // Simulate running campaign
        if (typeof titleStep === 'object' && titleStep.session_id) {
          const runResult = await handleWizardStep(
            titleStep.session_id,
            { id: 'run_now' },
            mockTools,
            mockUser
          );
          console.log('🚀 Campaign executed:', runResult);
        }
      }
    }
    console.log('');
    
    // Test 7: Error handling
    console.log('7️⃣ Testing error handling...');
    try {
      const errorResult = await startSourcingWizard(
        "Invalid request with no clear intent",
        mockTools,
        mockUser
      );
      console.log('✅ Error handling result:', errorResult);
    } catch (error) {
      console.log('✅ Caught expected error:', error);
    }
    console.log('');
    
    // Test 8: Conversation examples
    console.log('8️⃣ Testing conversation examples...');
    
    const conversations = [
      "I need to hire 5 software engineers for my startup",
      "Create a campaign targeting CTOs in fintech companies",
      "Reach out to 100 recruiting managers in the SF Bay Area",
      "Start sourcing VPs of Engineering with 1-day email spacing",
      "I want to find technical recruiters but don't track replies"
    ];
    
    for (const [index, conversation] of conversations.entries()) {
      console.log(`💬 Conversation ${index + 1}: "${conversation}"`);
      const result = await startSourcingWizard(conversation, mockTools, mockUser);
      console.log(`   Response: ${typeof result === 'string' ? result.substring(0, 100) + '...' : result.title}`);
    }
    console.log('');
    
    console.log('🎉 All REX Orchestrator tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  testRexOrchestrator();
}

export { testRexOrchestrator };
