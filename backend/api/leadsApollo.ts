import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/authMiddleware';
import { toApolloGeoString, parseApolloLocation, formatLocation } from '../utils/locationNormalizer';
import { searchAndEnrichPeople, ApolloSearchParams } from '../utils/apolloApi';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Helper function to wait between API calls
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// POST /api/leads/apollo/search
router.post('/search', requireAuth, async (req, res) => {
  const { jobTitle, keywords, location } = req.body;
  const userId = req.user?.id;

  console.log('[Apollo Search] Search params:', { jobTitle, keywords, location });

  try {
    // Get API key from settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings?.apollo_api_key) {
      console.error('[Apollo Search] API key error:', settingsError);
      return res.status(401).json({ error: 'No valid Apollo API key found' });
    }

    // Validate search parameters
    if (!jobTitle && !keywords && !location) {
      return res.status(400).json({ error: 'At least one search parameter is required' });
    }

    // Construct search params
    const searchParams: ApolloSearchParams = {
      api_key: settings.apollo_api_key,
      page: 1,
      per_page: 100
    };

    // Add search criteria
    if (jobTitle) {
      searchParams.person_titles = [jobTitle];
    }
    if (keywords) {
      searchParams.q_keywords = keywords;
    }
    if (location && location !== 'Any') {
      searchParams.person_locations = [toApolloGeoString(location)];
    }

    // Search and enrich the leads
    const { leads } = await searchAndEnrichPeople(searchParams);
    
    return res.json({ leads });
  } catch (error: any) {
    console.error('[Apollo Search] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(500).json({ 
      error: 'Failed to search leads',
      details: error.response?.data?.message || error.message
    });
  }
});

// POST /api/leads/apollo/validate-key
router.post('/validate-key', requireAuth, async (req, res) => {
  const { api_key } = req.body;
  if (!api_key) {
    console.log('Missing API key in request body');
    return res.status(400).json({ error: 'Missing API key' });
  }

  // Log the API key and its length for debugging
  console.log('Validating Apollo API key:', JSON.stringify(api_key));
  console.log('API key length:', api_key.length);
  console.log('Headers:', {
    'X-Api-Key': api_key
  });

  try {
    console.log('Making request to Apollo health endpoint...');
    // Use the correct health endpoint for API key validation
    const response = await axios.get('https://api.apollo.io/v1/auth/health', {
      headers: {
        'X-Api-Key': api_key
      }
    });
    console.log('Apollo health check successful:', response.data);
    res.json({ valid: true, health: response.data });
  } catch (err) {
    const errorData = (err as any).response?.data || (err as any).message;
    console.error('Apollo API key validation error:', {
      error: errorData,
      status: (err as any).response?.status,
      headers: (err as any).response?.headers
    });
    res.status(401).json({ valid: false, error: errorData || 'Invalid API key' });
    return;
  }
});

// GET /api/leads/apollo/locations
router.get('/locations', requireAuth, async (req, res) => {
  const { q } = req.query;
  const userId = req.user?.id;

  console.log('[Apollo Locations] Search query:', q);
  console.log('[Apollo Locations] User ID:', userId);

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid query parameter' });
  }

  try {
    // Get API key from settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    console.log('[Apollo Locations] Settings:', settings);
    console.log('[Apollo Locations] Settings error:', settingsError);

    if (settingsError || !settings?.apollo_api_key) {
      console.error('[Apollo Locations] API key error:', settingsError);
      return res.status(401).json({ error: 'No valid Apollo API key found' });
    }

    // Call Apollo API for location suggestions
    console.log('[Apollo Locations] Making API request...');
    const response = await axios.get('https://api.apollo.io/api/v1/organizations/search', {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      params: {
        api_key: settings.apollo_api_key,
        q_organization_locations: q,
        page: 1,
        per_page: 10
      }
    });

    console.log('[Apollo Locations] API response:', response.data);

    // Transform organizations into locations
    const locations = response.data?.organizations?.map((org: any) => {
      const location = org.primary_location || {};
      return {
        id: `${location.city || ''}-${location.state || ''}-${location.country || ''}`.toLowerCase().replace(/\s+/g, '-'),
        name: [location.city, location.state, location.country].filter(Boolean).join(', '),
        type: 'location',
        country: location.country,
        state: location.state,
        city: location.city
      };
    }).filter((loc: any) => loc.city || loc.state || loc.country) || [];

    // Remove duplicates
    const uniqueLocations = Array.from(new Map(locations.map((loc: any) => [loc.id, loc])).values());

    console.log('[Apollo Locations] Transformed locations:', uniqueLocations);
    return res.json({ locations: uniqueLocations });
  } catch (error: any) {
    console.error('[Apollo Locations] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    return res.status(500).json({ 
      error: 'Failed to fetch location suggestions',
      details: error.response?.data?.message || error.message
    });
  }
});

// POST /api/leads/apollo/save-key
router.post('/save-key', requireAuth, async (req, res) => {
  console.log('Starting save-key operation...');
  const { user_id, api_key } = req.body;
  
  console.log('Request body:', { user_id, api_key_length: api_key?.length });
  
  if (!user_id || !api_key) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Missing user_id or api_key' });
  }

  try {
    console.log('Validating API key...');
    // First validate the key again to ensure it's still valid
    try {
      await axios.get('https://api.apollo.io/v1/auth/health', {
        headers: {
          'X-Api-Key': api_key
        }
      });
      console.log('API key validation successful');
    } catch (err) {
      console.error('API key validation failed:', err);
      return res.status(401).json({ error: 'Invalid API key' });
    }

    console.log('Checking for existing user settings...');
    // First check if a user_settings record exists for this user
    const { data: existingSettings, error: selectError } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('user_id', user_id)
      .single();

    if (selectError) {
      console.error('Error checking existing settings:', selectError);
    }
    console.log('Existing settings check result:', { existingSettings, selectError });

    let result;
    if (!existingSettings) {
      console.log('No existing settings found, inserting new record...');
      // If no record exists, insert a new one
      result = await supabase
        .from('user_settings')
        .insert({ 
          user_id,
          apollo_api_key: api_key 
        })
        .select()
        .single();
    } else {
      console.log('Existing settings found, updating record...');
      // If record exists, update it
      result = await supabase
        .from('user_settings')
        .update({ apollo_api_key: api_key })
        .eq('user_id', user_id)
        .select()
        .single();
    }

    console.log('Database operation result:', {
      error: result.error,
      success: !result.error,
      data: result.data ? 'Data present' : 'No data'
    });

    if (result.error) {
      console.error('Error saving Apollo API key:', result.error);
      return res.status(500).json({ error: 'Failed to save API key' });
    }

    console.log('Successfully saved API key');
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('Error in save-key operation:', err);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

export default router; 