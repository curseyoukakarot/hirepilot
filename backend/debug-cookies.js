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
      .select('*')
      .eq('user_id', '02a42d5c-0f65-4c58-8175-8304610c2ddc');
    
    console.log('LinkedIn cookies for your user:');
    console.log('Count:', data?.length || 0);
    
    if (data?.length > 0) {
      console.log('Available columns:', Object.keys(data[0]));
      const latest = data[0];
      console.log('Latest cookie data:');
      console.log('- User ID:', latest.user_id);
      console.log('- Has li_at_cookie:', !!latest.li_at_cookie);
      console.log('- Has full_cookie:', !!latest.full_cookie);
      console.log('- li_at_cookie length:', latest.li_at_cookie?.length || 0);
      console.log('- full_cookie length:', latest.full_cookie?.length || 0);
    }
    
    if (error) console.log('Error:', error);
  } catch (err) {
    console.error('Script error:', err);
  }
})();