import axios from 'axios';

interface EnrichmentParams {
  leadId?: string;
  linkedinUrl: string;
}

export async function enrichLead(params: EnrichmentParams | string) {
  try {
    console.log('[Proxycurl] Input params:', params);
    
    // Handle both string and object parameters
    const linkedinUrl = typeof params === 'string' ? params : params.linkedinUrl;
    console.log('[Proxycurl] Extracted URL:', linkedinUrl);
    
    if (!linkedinUrl) {
      throw new Error('LinkedIn URL is required');
    }

    // Clean and normalize URL
    let cleanUrl = linkedinUrl.trim()
      .replace(/^http:/, 'https:')  // Convert http to https
      .replace(/^https:\/\/(?!www\.)/, 'https://www.'); // Ensure www. prefix
    // Remove trailing slash or semicolon
    cleanUrl = cleanUrl.replace(/[;\/]$/, '');
    
    console.log('[Proxycurl] Cleaned URL:', cleanUrl);
    
    if (!cleanUrl.match(/^https:\/\/www\.linkedin\.com\/in\/[^/]+$/)) {
      throw new Error('Invalid LinkedIn URL format');
    }

    // Get API key from environment
    const apiKey = process.env.PROXYCURL_API_KEY;
    console.log('[Proxycurl] key prefix:', (apiKey || '').substring(0, 10));
    if (!apiKey) {
      throw new Error('Proxycurl API key not found');
    }

    // Log request params for debugging
    console.log('[Proxycurl] Making request with params:', {
      url: cleanUrl,
      'extra[include]': 'personal_emails,personal_numbers,skills'
    });

    // Fetch profile data from Proxycurl
    const response = await axios.get('https://nubela.co/proxycurl/api/v2/linkedin', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      params: {
        url: cleanUrl,
        'extra[include]': 'personal_emails,personal_numbers,skills'
      },
    });

    // Log response for debugging
    console.log('[Proxycurl] Response:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('[Proxycurl] Error:', error);
    
    // Log detailed error information
    if (error.response) {
      console.error('[Proxycurl] Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    }
    
    // If we have a specific error message from Proxycurl, use it
    if (error.response?.data?.errors) {
      throw new Error(`Proxycurl API Error: ${JSON.stringify(error.response.data.errors)}`);
    }
    
    throw error; // Let the caller handle the error
  }
} 