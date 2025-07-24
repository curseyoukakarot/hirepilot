import express, { Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabase } from '../../../lib/supabase';
import { requireAuth } from '../../../../middleware/authMiddleware';
import { ApiRequest } from '../../../../types/api';

const router = express.Router();

// Decodo API configuration – default to new v2 "instant" endpoint but allow override via env
const DECODO_API_URL = process.env.DECODO_API_URL || 'https://scraper-api.decodo.com/v2/scrape';
const DECODO_API_KEY = process.env.DECODO_API_KEY;

interface DecodoTaskRequest {
  url: string;
  render: boolean;
  geo: string;
  proxy_type: string;
  user_agent: string;
}

interface DecodoTaskResponse {
  task_id: string;
  url: string;
  status: string;
  html?: string;
  error?: string;
}

interface ScrapingRequest {
  userId: string;
  campaignId: string;
  searchUrl: string;
  pagesToScrape: number;
}

interface LeadData {
  name: string;
  title: string;
  company: string;
  location: string;
  profileUrl: string;
  image?: string;
}

// Parse LinkedIn Sales Navigator HTML to extract lead data
function parseLinkedInSalesNavHTML(html: string): LeadData[] {
  const $ = cheerio.load(html);
  const leads: LeadData[] = [];

  // LinkedIn Sales Navigator uses different selectors than regular LinkedIn
  // These selectors target the search results list
  $('.artdeco-entity-lockup, .search-results__result-item').each((index, element) => {
    try {
      const $element = $(element);
      
      // Extract name - try multiple possible selectors
      const nameSelectors = [
        '.artdeco-entity-lockup__title a',
        '.result-lockup__name a',
        '.search-result__result-link',
        '.actor-name'
      ];
      let name = '';
      for (const selector of nameSelectors) {
        name = $element.find(selector).text().trim();
        if (name) break;
      }

      // Extract title
      const titleSelectors = [
        '.artdeco-entity-lockup__subtitle',
        '.result-lockup__highlight-keyword',
        '.search-result__truncate',
        '.subline-level-1'
      ];
      let title = '';
      for (const selector of titleSelectors) {
        title = $element.find(selector).text().trim();
        if (title) break;
      }

      // Extract company
      const companySelectors = [
        '.artdeco-entity-lockup__caption',
        '.result-lockup__position-company',
        '.subline-level-2',
        '.search-result__result-link[href*="/company/"]'
      ];
      let company = '';
      for (const selector of companySelectors) {
        company = $element.find(selector).text().trim();
        if (company) break;
      }

      // Extract location
      const locationSelectors = [
        '.artdeco-entity-lockup__metadata',
        '.result-lockup__misc-item',
        '.subline-level-1 .visually-hidden'
      ];
      let location = '';
      for (const selector of locationSelectors) {
        const text = $element.find(selector).text().trim();
        // Look for location patterns (city, state, country)
        if (text && (text.includes(',') || text.includes('Area') || text.includes('Region'))) {
          location = text;
          break;
        }
      }

      // Extract profile URL
      const profileLinkSelectors = [
        'a[href*="/lead/"]',
        'a[href*="/in/"]',
        '.artdeco-entity-lockup__title a',
        '.result-lockup__name a'
      ];
      let profileUrl = '';
      for (const selector of profileLinkSelectors) {
        const href = $element.find(selector).attr('href');
        if (href) {
          // Convert Sales Navigator URLs to regular LinkedIn profile URLs
          if (href.includes('/lead/')) {
            // Extract profile identifier and construct regular LinkedIn URL
            // For now, keep the Sales Navigator URL - we'll improve this later
            profileUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
          } else if (href.includes('/in/')) {
            profileUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
          }
          break;
        }
      }

      // Extract image (optional)
      const imageSelectors = [
        '.artdeco-entity-lockup__image img',
        '.result-lockup__image img',
        '.presence-entity__image img'
      ];
      let image = '';
      for (const selector of imageSelectors) {
        const src = $element.find(selector).attr('src');
        if (src) {
          image = src;
          break;
        }
      }

      // Only add lead if we have at least name and either title or company
      if (name && (title || company)) {
        leads.push({
          name: name,
          title: title || '',
          company: company || '',
          location: location || '',
          profileUrl: profileUrl || '',
          image: image || ''
        });
      }
    } catch (error) {
      console.error('[parseLinkedInSalesNavHTML] Error parsing lead element:', error);
    }
  });

  console.log(`[parseLinkedInSalesNavHTML] Extracted ${leads.length} leads from HTML`);
  return leads;
}

// Submit scraping task to Decodo API
async function submitDecodoTask(targetUrl: string): Promise<DecodoTaskResponse> {
  if (!DECODO_API_KEY) {
    throw new Error('DECODO_API_KEY environment variable is not set');
  }

  const taskRequest: DecodoTaskRequest = {
    url: targetUrl,
    render: true,
    geo: "us",
    proxy_type: "residential",
    user_agent: "desktop"
  };

  console.log(`[submitDecodoTask] Submitting task for URL: ${targetUrl}`);

  // Detect if we're using the new synchronous v2 endpoint
  const isInstant = DECODO_API_URL.includes('/v2/scrape');

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // v2 uses Basic auth whereas v1 uses Bearer
    headers['Authorization'] = isInstant ? `Basic ${DECODO_API_KEY}` : `Bearer ${DECODO_API_KEY}`;

    const response = await axios.post(DECODO_API_URL, taskRequest, {
      headers,
      timeout: 30000
    });

    // Instant mode: Return a synthetic DecodoTaskResponse with status completed
    if (isInstant) {
      const html = response.data?.html || response.data?.data || response.data;
      if (!html) throw new Error('No HTML content returned from Decodo');
      return {
        task_id: 'instant',
        url: targetUrl,
        status: 'completed',
        html
      } as DecodoTaskResponse;
    }

    // Legacy mode – return the task object for polling
    const result: DecodoTaskResponse = response.data;
    console.log(`[submitDecodoTask] Task submitted successfully: ${result.task_id}`);
    return result;

  } catch (error: any) {
    console.error('[submitDecodoTask] Error submitting task:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error(`Failed to submit Decodo task: ${error.message}`);
  }
}

// Poll Decodo task until completion
async function pollDecodoTask(taskId: string, maxAttempts: number = 30): Promise<DecodoTaskResponse> {
  // If task was handled synchronously, skip polling
  if (taskId === 'instant') {
    return {
      task_id: 'instant',
      url: '',
      status: 'completed'
    } as DecodoTaskResponse;
  }

  if (!DECODO_API_KEY) {
    throw new Error('DECODO_API_KEY environment variable is not set');
  }

  console.log(`[pollDecodoTask] Polling task ${taskId} for completion...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(`${DECODO_API_URL}/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${DECODO_API_KEY}`
        },
        timeout: 10000
      });

      const result: DecodoTaskResponse = response.data;
      console.log(`[pollDecodoTask] Attempt ${attempt}/${maxAttempts} - Status: ${result.status}`);

      if (result.status === 'completed') {
        console.log(`[pollDecodoTask] Task ${taskId} completed successfully`);
        return result;
      } else if (result.status === 'failed') {
        throw new Error(`Decodo task failed: ${result.error || 'Unknown error'}`);
      }

      // Wait before next poll (exponential backoff)
      const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));

    } catch (error: any) {
      if (attempt === maxAttempts) {
        console.error('[pollDecodoTask] Max attempts reached:', error.message);
        throw new Error(`Failed to complete Decodo task after ${maxAttempts} attempts`);
      }
      
      console.warn(`[pollDecodoTask] Attempt ${attempt} failed, retrying:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error(`Decodo task ${taskId} did not complete within ${maxAttempts} attempts`);
}

// Store leads in database
async function storeLeads(userId: string, campaignId: string, leads: LeadData[]): Promise<number> {
  if (leads.length === 0) {
    return 0;
  }

  console.log(`[storeLeads] Storing ${leads.length} leads for campaign ${campaignId}`);

  const leadsToInsert = leads.map(lead => {
    // Split name into first and last name
    const nameParts = lead.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      user_id: userId,
      campaign_id: campaignId,
      first_name: firstName,
      last_name: lastName,
      name: lead.name,
      title: lead.title,
      company: lead.company,
      linkedin_url: lead.profileUrl || null,
      location: lead.location || null,
      status: 'New',
      source: 'sales_navigator',
      enrichment_data: JSON.stringify({
        source: 'Sales Navigator',
        scraper: 'Decodo',
        location: lead.location,
        originalUrl: lead.profileUrl,
        image: lead.image
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  try {
    // Insert leads in batches to handle large datasets
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < leadsToInsert.length; i += batchSize) {
      const batch = leadsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('leads')
        .insert(batch)
        .select('id');

      if (error) {
        // Handle duplicate constraint errors gracefully
        if (error.code === '23505') {
          console.warn(`[storeLeads] Batch ${Math.floor(i/batchSize) + 1} contained duplicates, continuing...`);
          continue;
        }
        throw error;
      }

      totalInserted += data?.length || 0;
      console.log(`[storeLeads] Inserted batch ${Math.floor(i/batchSize) + 1}, total: ${totalInserted}`);
    }

    console.log(`[storeLeads] Successfully stored ${totalInserted} leads`);
    return totalInserted;

  } catch (error: any) {
    console.error('[storeLeads] Error storing leads:', error);
    throw new Error(`Failed to store leads: ${error.message}`);
  }
}

// Main scraping endpoint
router.post('/salesNavigatorScraper', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { campaignId, searchUrl, pagesToScrape }: ScrapingRequest = req.body;

    // Validation
    if (!campaignId || !searchUrl || !pagesToScrape) {
      res.status(400).json({ 
        error: 'Missing required fields: campaignId, searchUrl, and pagesToScrape are required' 
      });
      return;
    }

    if (pagesToScrape < 1 || pagesToScrape > 10) {
      res.status(400).json({ 
        error: 'pagesToScrape must be between 1 and 10' 
      });
      return;
    }

    // Verify campaign exists and belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      res.status(404).json({ error: 'Campaign not found or access denied' });
      return;
    }

    console.log(`[salesNavigatorScraper] Starting scraping for campaign: ${campaign.name}`);
    console.log(`[salesNavigatorScraper] URL: ${searchUrl}, Pages: ${pagesToScrape}`);

    const allLeads: LeadData[] = [];
    const errors: string[] = [];

    // Process each page
    for (let page = 1; page <= pagesToScrape; page++) {
      try {
        // Construct page URL
        const pageUrl = `${searchUrl}&page=${page}`;
        console.log(`[salesNavigatorScraper] Processing page ${page}/${pagesToScrape}: ${pageUrl}`);

        // Submit Decodo task
        const task = await submitDecodoTask(pageUrl);
        
        let htmlContent: string | undefined;

        if (task.status === 'completed' && task.html) {
          // Instant endpoint – HTML ready
          htmlContent = task.html;
        } else {
          // Poll legacy endpoint
          const completedTask = await pollDecodoTask(task.task_id);
          htmlContent = completedTask.html;
        }

        if (!htmlContent) {
          errors.push(`Page ${page}: No HTML content returned`);
          continue;
        }

        // Parse HTML to extract leads
        const pageLeads = parseLinkedInSalesNavHTML(htmlContent);
        console.log(`[salesNavigatorScraper] Page ${page} extracted ${pageLeads.length} leads`);
        
        allLeads.push(...pageLeads);

        // Add delay between pages to be respectful
        if (page < pagesToScrape) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error: any) {
        console.error(`[salesNavigatorScraper] Error processing page ${page}:`, error);
        errors.push(`Page ${page}: ${error.message}`);
      }
    }

    // Remove duplicates based on profile URL
    const uniqueLeads = allLeads.filter((lead, index, self) => 
      index === self.findIndex(l => l.profileUrl === lead.profileUrl && l.profileUrl !== '')
    );

    console.log(`[salesNavigatorScraper] Extracted ${allLeads.length} total leads, ${uniqueLeads.length} unique`);

    // Store leads in database
    let numStored = 0;
    if (uniqueLeads.length > 0) {
      numStored = await storeLeads(userId, campaignId, uniqueLeads);
    }

    const response = {
      success: true,
      numLeads: numStored,
      totalExtracted: allLeads.length,
      uniqueLeads: uniqueLeads.length,
      pagesProcessed: pagesToScrape - errors.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`[salesNavigatorScraper] Completed successfully:`, response);
    res.json(response);

  } catch (error: any) {
    console.error('[salesNavigatorScraper] Fatal error:', error);
    res.status(500).json({ 
      error: 'Scraping failed', 
      message: error.message 
    });
  }
});

export default router; 