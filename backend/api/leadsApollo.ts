import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/authMiddleware';
import { toApolloGeoString, parseApolloLocation, formatLocation } from '../utils/locationNormalizer';
import { searchAndEnrichPeople, ApolloSearchParams } from '../utils/apolloApi';
import { sendApolloSearchNotifications, sendApolloErrorNotifications } from '../services/apolloNotificationService';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Helper function to wait between API calls
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// POST /api/leads/apollo/search
router.post('/search', requireAuth, async (req, res) => {
  const { jobTitle, job_title, keywords, location, booleanSearch } = req.body;
  const userId = req.user?.id;

  // Handle both parameter formats (camelCase and snake_case)
  const actualJobTitle = jobTitle || job_title;

      console.log('[Apollo Search] Search params:', { 
      jobTitle: actualJobTitle, 
      keywords, 
      location,
      booleanSearch,
      original_body: req.body 
    });

    console.log('[Apollo Search] DETAILED MAPPING DEBUG:', {
      'Frontend job_title': req.body.job_title,
      'Frontend keywords': req.body.keywords,
      'Backend actualJobTitle': actualJobTitle,
      'Backend keywords': keywords,
      'Backend booleanSearch': booleanSearch,
      'actualJobTitle exists?': !!actualJobTitle,
      'keywords exists?': !!keywords
    });

  try {
    // Get user role to check for RecruitPro privileges
    const { data: userRecord, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userErr) console.error('[Apollo Search] user fetch error:', userErr);

    // Check if user is RecruitPro or other privileged type
    const privilegedTypes = ['RecruitPro', 'TeamAdmin', 'admin', 'member'];
    const userRole = userRecord?.role;
    const isRecruitPro = privilegedTypes.includes(userRole);

    // Get API key from settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settingsError) console.error('[Apollo Search] settings fetch error:', settingsError);

    // Determine which API key to use
    let apiKey: string | undefined;

    if (isRecruitPro) {
      apiKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
    } else if (settings?.apollo_api_key) {
      apiKey = settings.apollo_api_key;
    } else {
      apiKey = process.env.SUPER_ADMIN_APOLLO_API_KEY; // Fallback for backwards compatibility
    }

    if (!apiKey) {
      res.status(401).json({ error: 'No valid Apollo API key found' });
      return;
    }

    // Validate search parameters
    if (!actualJobTitle && !keywords && !location) {
      res.status(400).json({ error: 'At least one search parameter is required' });
      return;
    }

    // Validate Boolean search string if enabled
    if (booleanSearch && keywords) {
      const sanitizedKeywords = validateAndSanitizeBooleanSearch(keywords);
      if (!sanitizedKeywords) {
        res.status(400).json({ error: 'Invalid Boolean search syntax. Please check your query and try again.' });
        return;
      }
    }

    // Construct search params
    const searchParams: ApolloSearchParams = {
      api_key: apiKey,
      page: 1,
      per_page: 100
    };

    // Handle Boolean search mode vs regular mode
    if (booleanSearch && keywords) {
      // Boolean mode: Put Boolean job title search in person_titles, not q_keywords
      // Apollo supports Boolean syntax in person_titles field
      searchParams.person_titles = [keywords.trim()];
      console.log('[Apollo Search] Boolean mode enabled - using person_titles with Boolean syntax:', searchParams.person_titles);
    } else {
      // Regular mode: Use person_titles for job title and q_keywords for additional keywords
      if (actualJobTitle) {
        searchParams.person_titles = [actualJobTitle];
      }
      if (keywords) {
        searchParams.q_keywords = keywords;
      }
      console.log('[Apollo Search] Regular mode - using person_titles and q_keywords separately');
    }
    
    if (location && location !== 'Any') {
      searchParams.person_locations = [toApolloGeoString(location)];
    }

    // Debug logging - what we're sending to Apollo
    console.log('[Apollo Search] Final search params being sent to Apollo API:', {
      ...searchParams,
      api_key: '***'
    });

    console.log('[Apollo Search] CRITICAL DEBUG - What Apollo will receive:', {
      'person_titles': searchParams.person_titles,
      'q_keywords': searchParams.q_keywords,
      'person_locations': searchParams.person_locations,
      'Boolean mode enabled?': booleanSearch && !!keywords,
      'Will Apollo see job title?': !!searchParams.person_titles?.length,
      'Will Apollo see keywords?': !!searchParams.q_keywords
    });

    // Search and enrich the leads
    const { leads } = await searchAndEnrichPeople(searchParams);
    
    // Send notifications if campaignId is provided
    const campaignId = req.body.campaignId;
    if (campaignId && leads.length > 0) {
      const searchCriteria = {
        jobTitle: actualJobTitle || undefined,
        keywords: keywords || undefined,
        location: location !== 'Any' ? location : undefined
      };
      
      // Send success notifications asynchronously
      sendApolloSearchNotifications(userId, campaignId, searchCriteria, leads.length)
        .catch(error => {
          console.error('[Apollo Search] Error sending notifications:', error);
        });
    }
    
    res.json({ leads });
    return;
  } catch (error: any) {
    console.error('[Apollo Search] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Send error notifications if campaignId is provided
    const campaignId = req.body.campaignId;
    if (campaignId) {
      const searchCriteria = {
        jobTitle: actualJobTitle || undefined,
        keywords: keywords || undefined,
        location: location !== 'Any' ? location : undefined
      };
      
      // Send error notifications asynchronously
      sendApolloErrorNotifications(userId, campaignId, error.message, searchCriteria)
        .catch(notificationError => {
          console.error('[Apollo Search] Error sending error notifications:', notificationError);
        });
    }
    
    res.status(500).json({ 
      error: 'Failed to search leads',
      details: error.response?.data?.message || error.message
    });
    return;
  }
});

// POST /api/leads/apollo/validate-key
router.post('/validate-key', requireAuth, async (req, res) => {
  const { api_key } = req.body;
  if (!api_key) {
    console.log('Missing API key in request body');
    res.status(400).json({ error: 'Missing API key' });
    return;
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
    res.status(400).json({ error: 'Missing or invalid query parameter' });
    return;
  }

  try {
    // Get user role to check for RecruitPro privileges
    const { data: userRecord, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userErr) console.error('[Apollo Locations] user fetch error:', userErr);

    // Check if user is RecruitPro or other privileged type
    const privilegedTypes = ['RecruitPro', 'TeamAdmin', 'admin', 'member'];
    const userRole = userRecord?.role;
    const isRecruitPro = privilegedTypes.includes(userRole);

    // Get API key from settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settingsError) console.error('[Apollo Locations] settings fetch error:', settingsError);

    // Determine which API key to use
    let apiKey: string | undefined;

    if (isRecruitPro) {
      apiKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
    } else if (settings?.apollo_api_key) {
      apiKey = settings.apollo_api_key;
    } else {
      apiKey = process.env.SUPER_ADMIN_APOLLO_API_KEY; // Fallback for backwards compatibility
    }

    if (!apiKey) {
      res.status(401).json({ error: 'No valid Apollo API key found' });
      return;
    }

    // Call Apollo API for location suggestions
    console.log('[Apollo Locations] Making API request...');
    const response = await axios.get('https://api.apollo.io/api/v1/organizations/search', {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      params: {
        api_key: apiKey,
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
    res.json({ locations: uniqueLocations });
    return;
  } catch (error: any) {
    console.error('[Apollo Locations] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch location suggestions',
      details: error.response?.data?.message || error.message
    });
    return;
  }
});

// POST /api/leads/apollo/save-key
router.post('/save-key', requireAuth, async (req, res) => {
  console.log('Starting save-key operation...');
  const { user_id, api_key } = req.body;
  
  console.log('Request body:', { user_id, api_key_length: api_key?.length });
  
  if (!user_id || !api_key) {
    console.log('Missing required fields');
    res.status(400).json({ error: 'Missing user_id or api_key' });
    return;
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
      res.status(401).json({ error: 'Invalid API key' });
      return;
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
      res.status(500).json({ error: 'Failed to save API key' });
      return;
    }

    console.log('Successfully saved API key');
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('Error in save-key operation:', err);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

export default router; 

// Helper function to validate and sanitize Boolean search strings
function validateAndSanitizeBooleanSearch(query: string): string | null {
  if (!query || typeof query !== 'string') {
    return null;
  }

  const sanitized = query.trim();
  
  // Basic validation - check for balanced parentheses
  let openParens = 0;
  for (const char of sanitized) {
    if (char === '(') openParens++;
    if (char === ')') openParens--;
    if (openParens < 0) return null; // More closing than opening
  }
  if (openParens !== 0) return null; // Unmatched parentheses

  // Check for basic Boolean operators (case insensitive)
  const hasValidOperators = /\b(AND|OR|NOT)\b/i.test(sanitized);
  const hasQuotes = /"[^"]*"/.test(sanitized);
  
  // Allow if it has Boolean operators OR quoted phrases (or just plain text)
  if (sanitized.length > 0) {
    return sanitized;
  }
  
  return null;
} 