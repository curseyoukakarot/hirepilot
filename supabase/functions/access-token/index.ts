// Access Token Hook to inject role claims into JWTs
// This ensures every login token contains the correct role from the users table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Serve } from 'std/server';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export const serve: Serve = async (req) => {
  try {
    const { user } = await req.json();

    if (!user?.id) {
      return new Response(
        JSON.stringify({ error: 'No user provided' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get role from public.users table
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user role:', error);
    }

    // Determine role with fallbacks
    const role = data?.role || user.app_metadata?.role || user.user_metadata?.role || 'member';

    console.log(`Injecting role claim for user ${user.email || user.id}: ${role}`);

    return new Response(
      JSON.stringify({
        claims: {
          role,
          allowed_roles: ['super_admin', 'team_admin', 'recruitpro', 'member', 'authenticated']
        }
      }),
      { 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (err) {
    console.error('Access token hook error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};
