const { createClient } = require('@supabase/supabase-js');
const { sendApolloSearchNotifications } = require('./services/apolloNotificationService');

async function testNotifications() {
  console.log('Testing notifications for user: brandon.omoregie@outlook.com');
  
  const userId = '02a42d5c-0f65-4c58-8175-8304610c2ddc';
  const testCampaignId = 'test-campaign-id';
  const searchCriteria = {
    jobTitle: 'Software Engineer',
    keywords: 'React, Node.js',
    location: 'San Francisco'
  };
  const leadCount = 5;

  try {
    // Test Apollo notifications
    console.log('Testing Apollo notifications...');
    await sendApolloSearchNotifications(userId, testCampaignId, searchCriteria, leadCount);
    console.log('Apollo notification test completed');
    
  } catch (error) {
    console.error('Error testing notifications:', error);
  }
}

testNotifications(); 