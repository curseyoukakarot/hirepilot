// Campaign Attribution Fix - Browser Console Script
// Copy and paste this entire script into your browser console on thehirepilot.com

(async function() {
  console.log('🚀 Campaign Attribution Fix Tool (Browser Version)');
  console.log('====================================================\n');

  // Step 1: Get user ID from Supabase auth
  let userId = null;
  
  try {
    // Try to get from localStorage
    const authKeys = Object.keys(localStorage).filter(key => key.includes('supabase') && key.includes('auth'));
    
    for (const key of authKeys) {
      try {
        const authData = JSON.parse(localStorage.getItem(key));
        if (authData && authData.access_token) {
          // Decode JWT to get user ID
          const payload = JSON.parse(atob(authData.access_token.split('.')[1]));
          if (payload.sub) {
            userId = payload.sub;
            console.log('✅ Found user ID from localStorage:', userId);
            break;
          }
        }
      } catch (e) {
        // Continue to next key
      }
    }
    
    // If not found in localStorage, try window.supabase if available
    if (!userId && window.supabase) {
      const { data } = await window.supabase.auth.getUser();
      if (data?.user?.id) {
        userId = data.user.id;
        console.log('✅ Found user ID from Supabase:', userId);
      }
    }
  } catch (error) {
    console.log('⚠️  Could not automatically detect user ID:', error.message);
  }

  if (!userId) {
    console.log('❌ Could not find user ID automatically.');
    console.log('Please manually set your user ID by running:');
    console.log('   const USER_ID = "your-user-id-here";');
    console.log('Then run this script again.');
    return;
  }

  // Validation function
  function isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  if (!isValidUUID(userId)) {
    console.log('❌ User ID format looks incorrect:', userId);
    console.log('Please verify your user ID and set it manually.');
    return;
  }

  console.log(`📍 Using User ID: ${userId}\n`);

  // Helper function to make API requests
  async function makeAPIRequest(endpoint, method = 'GET') {
    try {
      const url = `https://api.thehirepilot.com/api${endpoint}`;
      console.log(`Making ${method} request to: ${url}`);
      
      const response = await fetch(url, { method });
      const data = await response.json();
      
      return { status: response.status, data };
    } catch (error) {
      console.error('API request failed:', error);
      return { status: 0, data: { error: error.message } };
    }
  }

  // Step 1: Diagnose issues
  console.log('🔍 STEP 1: Diagnosing campaign attribution issues...\n');
  
  const diagnosisResponse = await makeAPIRequest(`/debug/campaign-metrics?user_id=${userId}`);
  
  if (diagnosisResponse.status === 200) {
    const data = diagnosisResponse.data;
    console.log('✅ Diagnosis successful!');
    console.log(`📊 Analysis Results:`);
    console.log(`   - Total campaigns: ${data.analysis.total_campaigns}`);
    console.log(`   - Total messages: ${data.analysis.total_messages}`);
    console.log(`   - Total email events: ${data.analysis.total_email_events}`);
    
    console.log(`\n📈 Messages by campaign:`);
    Object.entries(data.analysis.messages_by_campaign).forEach(([campaignId, count]) => {
      console.log(`   - ${campaignId === 'null' ? '❌ No Campaign' : '✅ ' + campaignId}: ${count} messages`);
    });
    
    console.log(`\n📧 Email events by campaign:`);
    Object.entries(data.analysis.events_by_campaign).forEach(([campaignId, count]) => {
      console.log(`   - ${campaignId === 'null' ? '❌ No Campaign' : '✅ ' + campaignId}: ${count} events`);
    });
    
    if (data.analysis.potential_issues.length > 0) {
      console.log(`\n⚠️  Issues Found:`);
      data.analysis.potential_issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.issue}`);
        console.log(`      📋 ${issue.description}`);
        console.log(`      💥 Impact: ${issue.impact}`);
      });
      
      // Step 2: Dry run
      console.log('\n🔬 STEP 2: Preview the fix (dry run)...\n');
      
      const dryRunResponse = await makeAPIRequest(`/backfill/campaign-attribution?user_id=${userId}&dry_run=true`, 'POST');
      
      if (dryRunResponse.status === 200) {
        const dryData = dryRunResponse.data;
        console.log('✅ Dry run successful!');
        console.log(`📋 Dry Run Results:`);
        console.log(`   - Messages to fix: ${dryData.messages_fixed}`);
        console.log(`   - Email events to fix: ${dryData.email_events_fixed}`);
        console.log(`   - Total fixes needed: ${dryData.summary.total_fixes}`);
        
        if (dryData.summary.total_fixes > 0) {
          console.log('\n❓ Ready to apply the fix? Run the following command:');
          console.log('   applyFix();');
          
          // Define the apply function in global scope
          window.applyFix = async function() {
            console.log('\n🔧 STEP 3: Applying the fix...\n');
            
            const fixResponse = await makeAPIRequest(`/backfill/campaign-attribution?user_id=${userId}&dry_run=false`, 'POST');
            
            if (fixResponse.status === 200) {
              const fixData = fixResponse.data;
              console.log('🎉 Fix applied successfully!');
              console.log(`🎯 Results:`);
              console.log(`   - Messages fixed: ${fixData.messages_fixed}`);
              console.log(`   - Email events fixed: ${fixData.email_events_fixed}`);
              console.log(`   - Total fixes: ${fixData.summary.total_fixes}`);
              
              if (fixData.summary.total_fixes > 0) {
                console.log('\n✅ SUCCESS! Your campaign metrics should now show the correct numbers.');
                console.log('\n📱 Try asking REX: "Can you tell me the stats of my most recent campaign?"');
              }
            } else {
              console.log('❌ Fix failed:', fixResponse.data);
            }
          };
          
        } else {
          console.log('\n✅ No fixes needed - your attribution is already correct!');
        }
      } else {
        console.log('❌ Dry run failed:', dryRunResponse.data);
      }
    } else {
      console.log('\n✅ No attribution issues found! Your campaign metrics should be working correctly.');
    }
  } else if (diagnosisResponse.status === 404) {
    console.log('❌ Debug endpoint not found. The new API endpoints may not be deployed yet.');
    console.log('Let me try using the existing campaign performance endpoint instead...\n');
    
    // Alternative approach using existing endpoints
    const campaignResponse = await makeAPIRequest(`/campaigns/all/performance?user_id=${userId}`);
    
    if (campaignResponse.status === 200) {
      console.log('✅ Campaign data found:');
      console.log('📊 Current metrics:', campaignResponse.data);
      
      if (campaignResponse.data.sent === 0) {
        console.log('\n⚠️  ISSUE CONFIRMED: Sent count is 0 despite you sending messages.');
        console.log('This confirms the campaign attribution issue.');
        console.log('\nThe fix endpoints are not yet deployed. Please wait for deployment or contact support.');
      } else {
        console.log('\n✅ Metrics look correct! You may not have attribution issues.');
      }
    } else {
      console.log('❌ Campaign performance check failed:', campaignResponse.data);
    }
  } else {
    console.log('❌ Diagnosis failed:', diagnosisResponse.data);
  }
})(); 