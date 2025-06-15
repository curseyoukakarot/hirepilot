import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getApolloToken(userId: string) {
  let { data: acct } = await supabase
    .from('apollo_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!acct) throw new Error('User has not connected Apollo');

  // access_token still valid?
  if (new Date(acct.expires_at) > new Date(Date.now() + 60_000)) {
    return acct.access_token;
  }

  // refresh it
  const res = await axios.post('https://api.apollo.io/v1/auth/refresh_token', {
    refresh_token: acct.refresh_token,
  });

  const { access_token, expires_at } = res.data;

  await supabase
    .from('apollo_accounts')
    .update({ access_token, expires_at })
    .eq('user_id', userId);

  return access_token;
}

export async function enrichLead(token: string, lead: {
  first_name: string;
  last_name: string;
  company_name: string;
  linkedin_url: string;
}) {
  const { data } = await axios.post(
    'https://api.apollo.io/v1/people/match',
    {
      first_name: lead.first_name,
      last_name: lead.last_name,
      organization_name: lead.company_name,
      linkedin_url: lead.linkedin_url,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data;
} 