require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    const { data, error } = await supabase
      .from('linkedin_cookies')
      .select('session_cookie, user_agent, is_valid, updated_at')
      .eq('user_id', '02a42d5c-0f65-4c58-8175-8304610c2ddc')
      .eq('is_valid', true)
      .single();
    
    console.log('Query result:');
    console.log('- data found:', !!data);
    console.log('- error:', error);
    
    if (data) {
      console.log('- has session_cookie:', !!data.session_cookie);
      console.log('- is_valid:', data.is_valid);
      console.log('✅ Query worked! Cookie found and valid.');
    } else {
      console.log('❌ No data returned from query');
    }
  } catch (err) {
    console.error('Script error:', err);
  }
})();