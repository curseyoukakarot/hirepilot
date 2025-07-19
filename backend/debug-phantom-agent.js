require('dotenv').config();

async function debugPhantomAgent() {
  try {
    console.log('🔍 Debugging PhantomBuster agent configuration...\n');

    const phantomApiKey = process.env.PHANTOMBUSTER_API_KEY;
    const agentId = "3884877398641652"; // Your brand new agent

    console.log(`🎯 Agent ID: ${agentId}`);
    console.log(`🔑 API Key: ${phantomApiKey?.substring(0, 10)}...`);
    console.log('');

    // Get agent info
    const agentInfoCurl = `curl -X GET 'https://api.phantombuster.com/api/v2/agents/${agentId}' \\
  -H 'X-Phantombuster-Key: ${phantomApiKey}'`;

    console.log('🔧 Get Agent Info Curl:');
    console.log('```bash');
    console.log(agentInfoCurl);
    console.log('```\n');

    // Get agent output/database
    const agentOutputCurl = `curl -X GET 'https://api.phantombuster.com/api/v2/agents/${agentId}/output' \\
  -H 'X-Phantombuster-Key: ${phantomApiKey}'`;

    console.log('🗄️ Get Agent Database/Output Curl:');
    console.log('```bash');
    console.log(agentOutputCurl);
    console.log('```\n');

    // Check for recent executions
    const agentLaunchesCurl = `curl -X GET 'https://api.phantombuster.com/api/v2/agents/${agentId}/launches' \\
  -H 'X-Phantombuster-Key: ${phantomApiKey}'`;

    console.log('🚀 Get Agent Launch History Curl:');
    console.log('```bash');
    console.log(agentLaunchesCurl);
    console.log('```\n');

    console.log('📋 Debugging Steps:');
    console.log('1. Run the "Get Agent Info" curl to see configuration');
    console.log('2. Run the "Get Agent Database" curl to see what\'s cached');
    console.log('3. Run the "Get Launch History" curl to see previous runs');
    console.log('4. Look for any linked spreadsheets or databases\n');

    console.log('🔍 What to Look For:');
    console.log('• spreadsheetUrl in agent configuration');
    console.log('• Any shared databases between agents');
    console.log('• Global deduplication settings');
    console.log('• Cached/processed items in the output\n');

    console.log('🛠️ Potential Solutions:');
    console.log('1. Create a completely new agent from scratch (not duplicate)');
    console.log('2. Use a different Google Spreadsheet or no spreadsheet');
    console.log('3. Clear any shared databases manually');
    console.log('4. Check PhantomBuster account settings for global deduplication');

  } catch (error) {
    console.error('❌ Error debugging agent:', error);
  }
}

// Run the debug
debugPhantomAgent(); 