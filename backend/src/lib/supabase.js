const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Current env vars:', {
    SUPABASE_URL: supabaseUrl ? 'Set' : 'Missing',
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? 'Set' : 'Missing'
  });
  process.exit(1);
}

// Log successful initialization
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Service Key:', supabaseKey ? 'Loaded' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase }; 