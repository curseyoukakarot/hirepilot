// supabase/functions/zap-events/index.ts
// Supabase Edge Function to expose zap_events for Zapier/Make.com triggers

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract API key from header
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing X-API-Key header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate API key and get user
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id')
      .eq('key', apiKey)
      .single();

    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const userId = apiKeyData.user_id;

    // Parse query parameters
    const url = new URL(req.url);
    const eventType = url.searchParams.get('event_type');
    const since = url.searchParams.get('since');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100); // Max 100 events
    const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1);
    const offset = (page - 1) * limit;

    // Build query for zap_events
    let query = supabase
      .from('zap_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        query = query.gt('created_at', sinceDate.toISOString());
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get total count for pagination metadata
    let countQuery = supabase
      .from('zap_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (eventType) {
      countQuery = countQuery.eq('event_type', eventType);
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        countQuery = countQuery.gt('created_at', sinceDate.toISOString());
      }
    }

    const { count: totalCount } = await countQuery;

    // Format response
    const response = {
      events: events || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        has_more: (totalCount || 0) > offset + limit
      },
      filters: {
        event_type: eventType,
        since: since
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}); 