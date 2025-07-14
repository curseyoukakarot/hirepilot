#!/usr/bin/env node

// Simple script to help find your user ID

console.log('🔍 User ID Finder');
console.log('==================\n');

console.log('To find your user ID, you have a few options:\n');

console.log('OPTION 1: From the JWT token you shared earlier');
console.log('The JWT token had this user ID in the "sub" field: 02a42d5c-0f65-4c58-8175-830461c2ddc');
console.log('Let me verify this is a valid UUID...\n');

const userIdFromToken = '02a42d5c-0f65-4c58-8175-830461c2ddc';
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (uuidRegex.test(userIdFromToken)) {
  console.log('✅ The user ID from your JWT token looks valid!');
  console.log(`   User ID: ${userIdFromToken}\n`);
} else {
  console.log('❌ The user ID from the JWT token is not a valid UUID format\n');
}

console.log('OPTION 2: From browser dev tools');
console.log('1. Open https://thehirepilot.com in your browser');
console.log('2. Open Dev Tools (F12)');
console.log('3. Go to Application tab → Local Storage');
console.log('4. Look for keys like "supabase.auth.token" or similar');
console.log('5. The user ID will be in the "sub" field of the JWT\n');

console.log('OPTION 3: From network requests');
console.log('1. Open https://thehirepilot.com in your browser');
console.log('2. Open Dev Tools (F12) → Network tab');
console.log('3. Refresh the page');
console.log('4. Look for API requests to api.thehirepilot.com');
console.log('5. Check the request headers for Authorization: Bearer [token]');
console.log('6. Decode the JWT token to get the user ID\n');

console.log('OPTION 4: Try a test API call');
console.log('Let me try to make a simple API call to see if we can identify any issues...\n');

// Test the API with a simple call
const https = require('https');

function makeTestRequest() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.thehirepilot.com',
      path: '/api/appHealth',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

async function testAPI() {
  try {
    console.log('Testing API connectivity...');
    const response = await makeTestRequest();
    
    if (response.status === 200) {
      console.log('✅ API is accessible!');
      console.log('Response:', response.data);
    } else {
      console.log(`⚠️  API responded with status ${response.status}`);
      console.log('Response:', response.data);
    }
  } catch (error) {
    console.log('❌ API test failed:', error.message);
  }
}

// Run the API test
testAPI();

console.log('\nOnce you have your correct user ID, update the fix_campaign_attribution.js file');
console.log('and run it again to fix your campaign attribution issues.'); 