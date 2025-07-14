#!/usr/bin/env node

const https = require('https');
const http = require('http');

const API_BASE = 'https://api.thehirepilot.com/api';

// You'll need to replace this with your actual user ID
// You can get it from your browser dev tools when logged into the app
const USER_ID = '02a42d5c-0f65-4c58-8175-830461c2ddc'; // Replace with your actual user ID

async function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Campaign Attribution Fix Script'
      }
    };

    const requestModule = urlObj.protocol === 'https:' ? https : http;
    
    const req = requestModule.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

async function step1_diagnose() {
  console.log('🔍 STEP 1: Diagnosing campaign attribution issues...\n');
  
  try {
    const url = `${API_BASE}/debug/campaign-metrics?user_id=${USER_ID}`;
    console.log(`Making request to: ${url}`);
    
    const response = await makeRequest(url);
    
    if (response.status === 200) {
      console.log('✅ Diagnosis successful!\n');
      
      const data = response.data;
      console.log(`📊 Analysis Results:`);
      console.log(`   - Total campaigns: ${data.analysis.total_campaigns}`);
      console.log(`   - Total messages: ${data.analysis.total_messages}`);
      console.log(`   - Total email events: ${data.analysis.total_email_events}`);
      console.log(`   - Messages without email events: ${data.analysis.messages_without_email_events.length}`);
      
      console.log(`\n📈 Messages by campaign:`);
      Object.entries(data.analysis.messages_by_campaign).forEach(([campaignId, count]) => {
        console.log(`   - ${campaignId === 'null' ? 'No Campaign' : campaignId}: ${count} messages`);
      });
      
      console.log(`\n📧 Email events by campaign:`);
      Object.entries(data.analysis.events_by_campaign).forEach(([campaignId, count]) => {
        console.log(`   - ${campaignId === 'null' ? 'No Campaign' : campaignId}: ${count} events`);
      });
      
      if (data.analysis.potential_issues.length > 0) {
        console.log(`\n⚠️  Potential Issues Found:`);
        data.analysis.potential_issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.issue}: ${issue.description}`);
          console.log(`      Impact: ${issue.impact}`);
          if (issue.solution) {
            console.log(`      Solution: ${issue.solution}`);
          }
        });
      } else {
        console.log(`\n✅ No attribution issues found!`);
      }
      
      return data.analysis.potential_issues.length > 0;
    } else {
      console.log(`❌ Error (${response.status}):`, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Error making request:', error.message);
    return false;
  }
}

async function step2_dryRun() {
  console.log('\n🔬 STEP 2: Preview the fix (dry run)...\n');
  
  try {
    const url = `${API_BASE}/backfill/campaign-attribution?user_id=${USER_ID}&dry_run=true`;
    console.log(`Making request to: ${url}`);
    
    const response = await makeRequest(url, 'POST');
    
    if (response.status === 200) {
      console.log('✅ Dry run successful!\n');
      
      const data = response.data;
      console.log(`📋 Dry Run Results:`);
      console.log(`   - Messages to fix: ${data.messages_fixed}`);
      console.log(`   - Email events to fix: ${data.email_events_fixed}`);
      console.log(`   - Total fixes needed: ${data.summary.total_fixes}`);
      console.log(`   - Errors: ${data.summary.errors_count}`);
      
      if (data.errors.length > 0) {
        console.log(`\n❌ Errors found:`);
        data.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.step}: ${error.error}`);
        });
      }
      
      console.log(`\n💡 ${data.summary.recommendation}`);
      
      return data.summary.total_fixes > 0 && data.summary.errors_count === 0;
    } else {
      console.log(`❌ Error (${response.status}):`, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Error making request:', error.message);
    return false;
  }
}

async function step3_applyFix() {
  console.log('\n🔧 STEP 3: Applying the fix...\n');
  
  try {
    const url = `${API_BASE}/backfill/campaign-attribution?user_id=${USER_ID}&dry_run=false`;
    console.log(`Making request to: ${url}`);
    
    const response = await makeRequest(url, 'POST');
    
    if (response.status === 200) {
      console.log('✅ Fix applied successfully!\n');
      
      const data = response.data;
      console.log(`🎯 Fix Results:`);
      console.log(`   - Messages fixed: ${data.messages_fixed}`);
      console.log(`   - Email events fixed: ${data.email_events_fixed}`);
      console.log(`   - Total fixes applied: ${data.summary.total_fixes}`);
      console.log(`   - Errors: ${data.summary.errors_count}`);
      
      if (data.errors.length > 0) {
        console.log(`\n❌ Errors encountered:`);
        data.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.step}: ${error.error}`);
        });
      }
      
      console.log(`\n💡 ${data.summary.recommendation}`);
      
      if (data.summary.total_fixes > 0 && data.summary.errors_count === 0) {
        console.log(`\n🎉 Success! Your campaign metrics should now show the correct numbers.`);
        console.log(`\n📱 Try asking REX again: "Can you tell me the stats of my most recent campaign?"`);
        return true;
      } else if (data.summary.total_fixes === 0) {
        console.log(`\n✅ No fixes were needed - your attribution is already correct!`);
        return true;
      } else {
        console.log(`\n⚠️  Some issues occurred during the fix.`);
        return false;
      }
    } else {
      console.log(`❌ Error (${response.status}):`, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Error making request:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Campaign Attribution Fix Tool');
  console.log('==================================\n');
  
  if (!USER_ID || USER_ID === 'YOUR_USER_ID_HERE') {
    console.log('❌ Please update the USER_ID variable in this script with your actual user ID.');
    console.log('   You can find your user ID in the browser dev tools when logged into the app.');
    console.log('   Look for "user" object in localStorage or network requests.');
    return;
  }
  
  // Step 1: Diagnose
  const hasIssues = await step1_diagnose();
  
  if (!hasIssues) {
    console.log('\n✅ No issues found! Your campaign attribution is working correctly.');
    return;
  }
  
  // Step 2: Dry run
  const shouldProceed = await step2_dryRun();
  
  if (!shouldProceed) {
    console.log('\n⚠️  Issues found in dry run. Please check the errors above.');
    return;
  }
  
  // Ask for confirmation
  console.log('\n❓ Do you want to apply the fix? (The dry run looks good!)');
  console.log('   Press Ctrl+C to cancel, or just wait 5 seconds to proceed...');
  
  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 3: Apply fix
  await step3_applyFix();
}

// Run the script
main().catch(console.error); 