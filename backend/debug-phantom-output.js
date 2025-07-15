const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hvbigxctlqwlrptnlayq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugPhantomOutput() {
  try {
    console.log('🔍 Debugging PhantomBuster output for execution 3975094423663143...');
    
    // Fetch directly from PhantomBuster API
    const response = await axios.get('https://api.phantombuster.com/api/v2/containers/fetch-output', {
      params: {
        id: '3975094423663143'
      },
      headers: {
        'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY
      },
      timeout: 30000
    });

    const { output, status } = response.data;
    
    console.log('\n📊 OUTPUT ANALYSIS:');
    console.log(`Status: ${status}`);
    console.log(`Total length: ${output?.length || 0} characters`);
    console.log(`Type: ${typeof output}`);
    
    if (typeof output === 'string') {
      console.log('\n📝 CONTENT BREAKDOWN:');
      
      // Show first 500 chars
      console.log('First 500 chars:');
      console.log('═'.repeat(50));
      console.log(output.substring(0, 500));
      console.log('═'.repeat(50));
      
      // Show last 500 chars
      console.log('\nLast 500 chars:');
      console.log('═'.repeat(50));
      console.log(output.substring(output.length - 500));
      console.log('═'.repeat(50));
      
      // Look for JSON patterns
      const firstBracket = output.indexOf('[');
      const firstBrace = output.indexOf('{');
      const lastBracket = output.lastIndexOf(']');
      const lastBrace = output.lastIndexOf('}');
      
      console.log('\n🔍 JSON MARKERS:');
      console.log(`First [ at position: ${firstBracket}`);
      console.log(`First { at position: ${firstBrace}`);
      console.log(`Last ] at position: ${lastBracket}`);
      console.log(`Last } at position: ${lastBrace}`);
      
      // Count newlines to see if it's mostly logs
      const lineCount = output.split('\n').length;
      console.log(`Total lines: ${lineCount}`);
      console.log(`Average chars per line: ${Math.round(output.length / lineCount)}`);
      
      // Look for common log patterns
      const logPatterns = [
        /\(node:\d+\)/g,
        /WARNING/g,
        /NOTE/g,
        /ERROR/g,
        /DEBUG/g,
        /INFO/g,
        /AWS SDK/g,
        /deprecated/gi,
        /DeprecationWarning/g
      ];
      
      console.log('\n⚠️  LOG PATTERN ANALYSIS:');
      logPatterns.forEach(pattern => {
        const matches = output.match(pattern);
        if (matches) {
          console.log(`${pattern.source}: ${matches.length} occurrences`);
        }
      });
      
      // Try to find the actual JSON data
      console.log('\n🎯 ATTEMPTING JSON EXTRACTION:');
      try {
        // Try different starting points
        const jsonStart = Math.min(
          firstBracket !== -1 ? firstBracket : Infinity,
          firstBrace !== -1 ? firstBrace : Infinity
        );
        
        if (jsonStart !== Infinity) {
          const potentialJson = output.substring(jsonStart);
          console.log(`Potential JSON starts at position ${jsonStart}`);
          console.log(`JSON portion length: ${potentialJson.length} characters`);
          
          // Try to parse just a sample
          const jsonSample = potentialJson.substring(0, 1000);
          console.log('\nJSON sample (first 1000 chars):');
          console.log('─'.repeat(50));
          console.log(jsonSample);
          console.log('─'.repeat(50));
          
          // Try to parse the full JSON
          const parsed = JSON.parse(potentialJson);
          console.log(`\n✅ SUCCESSFULLY PARSED JSON!`);
          console.log(`Type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`);
          console.log(`Lead count: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
          
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('\n👤 SAMPLE LEAD DATA:');
            console.log(JSON.stringify(parsed[0], null, 2));
            
            console.log('\n📋 LEAD FIELDS ANALYSIS:');
            const firstLead = parsed[0];
            console.log('Available fields:', Object.keys(firstLead));
            console.log('Field sizes:');
            Object.entries(firstLead).forEach(([key, value]) => {
              const size = typeof value === 'string' ? value.length : JSON.stringify(value).length;
              console.log(`  ${key}: ${size} chars`);
            });
          }
        }
      } catch (parseError) {
        console.error('❌ JSON parsing failed:', parseError.message);
      }
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error.message);
  }
}

debugPhantomOutput(); 