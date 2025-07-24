import express, { Request, Response } from 'express';
import { supabase } from '../../../lib/supabase';
import { requireAuth } from '../../../../middleware/authMiddleware';
import { ApiRequest } from '../../../../types/api';
import { DecodoClient } from '../../../utils/decodo';
import { parseSalesNavigatorSearchResults } from '../../../utils/cheerio/salesNavParser';
import enrichmentProcessor from '../../../cron/enrichmentProcessor';

const router = express.Router();

interface LinkedInTriggerRequest {
  campaignId: string;
  searchUrl: string;
  pagesToScrape?: number;
}

/**
 * Trigger LinkedIn Sales Navigator search using Decodo API
 * POST /api/campaigns/linkedin/trigger
 */
router.post('/trigger', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { campaignId, searchUrl, pagesToScrape = 3 }: LinkedInTriggerRequest = req.body;
    const userId = req.user!.id;

    console.log(`[LinkedInTrigger] Starting Sales Navigator search for campaign ${campaignId}`);

    // Validate required fields
    if (!campaignId || !searchUrl) {
      return res.status(400).json({ 
        error: 'campaignId and searchUrl are required' 
      });
    }

    // Validate search URL
    if (!searchUrl.includes('linkedin.com/sales')) {
      return res.status(400).json({ 
        error: 'Invalid LinkedIn Sales Navigator URL' 
      });
    }

    // Verify campaign exists and belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      console.error('[LinkedInTrigger] Campaign not found:', campaignError);
      return res.status(404).json({ 
        error: 'Campaign not found or access denied' 
      });
    }

    // Check user credits
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('scraping_credits')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('[LinkedInTrigger] User not found:', userError);
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    // Check if user has sufficient credits (1 credit per page)
    const creditsRequired = pagesToScrape;
    if (user.scraping_credits < creditsRequired) {
      return res.status(402).json({ 
        error: `Insufficient credits. You need ${creditsRequired} scraping credits but only have ${user.scraping_credits}` 
      });
    }

    // Update campaign status to "running"
    await supabase
      .from('campaigns')
      .update({ 
        status: 'running',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

         // Initialize Decodo client
     const { getDecodoClient } = await import('../../../utils/decodo');
     const decodoClient = getDecodoClient();
    let totalLeads = 0;
    const allLeads: any[] = [];

    try {
      // Scrape each page
      for (let page = 1; page <= pagesToScrape; page++) {
        console.log(`[LinkedInTrigger] Scraping page ${page}/${pagesToScrape}`);
        
        try {
          // Use Decodo to scrape the page
          const html = await decodoClient.scrapeSalesNavigatorSearch(searchUrl, page);
          
          // Parse the HTML to extract leads
          const pageLeads = parseSalesNavigatorSearchResults(html);
          
          if (pageLeads.length === 0) {
            console.log(`[LinkedInTrigger] No leads found on page ${page}, stopping`);
            break;
          }

          // Transform leads for database insertion
          const transformedLeads = pageLeads.map(lead => ({
            user_id: userId,
            campaign_id: campaignId,
            first_name: lead.name.split(' ')[0] || '',
            last_name: lead.name.split(' ').slice(1).join(' ') || '',
            name: lead.name,
            title: lead.title,
            company: lead.company,
            location: lead.location,
            linkedin_url: lead.profileUrl,
            source: 'sales_navigator',
            status: 'New',
            image_url: lead.image || null,
            enrichment_data: {
              connection_degree: lead.connectionDegree || '',
              scraped_page: page,
              scraped_at: new Date().toISOString()
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          allLeads.push(...transformedLeads);
          totalLeads += pageLeads.length;

          console.log(`[LinkedInTrigger] Page ${page}: Found ${pageLeads.length} leads`);

          // Add delay between pages to be respectful
          if (page < pagesToScrape) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (pageError) {
          console.error(`[LinkedInTrigger] Error scraping page ${page}:`, pageError);
          // Continue with next page instead of failing completely
          continue;
        }
      }

      if (allLeads.length === 0) {
        // Update campaign status to failed
        await supabase
          .from('campaigns')
          .update({ 
            status: 'failed',
            error_message: 'No leads found in Sales Navigator search',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId);

        return res.status(400).json({ 
          error: 'No leads found in the Sales Navigator search results' 
        });
      }

      // Insert leads into database (handle duplicates)
      const { data: insertedLeads, error: insertError } = await supabase
        .from('leads')
        .upsert(allLeads, { 
          onConflict: 'linkedin_url,campaign_id',
          ignoreDuplicates: true 
        })
        .select('id, linkedin_url');

      if (insertError) {
        console.error('[LinkedInTrigger] Error inserting leads:', insertError);
        throw new Error(`Failed to save leads: ${insertError.message}`);
      }

      const actualInserted = insertedLeads?.length || 0;
      console.log(`[LinkedInTrigger] Successfully inserted ${actualInserted} unique leads`);

      // Deduct credits after successful scraping
      await supabase
        .from('users')
        .update({ 
          scraping_credits: user.scraping_credits - creditsRequired 
        })
        .eq('id', userId);

      // Log credit usage
      await supabase
        .from('credit_usage_log')
        .insert({
          user_id: userId,
          amount: creditsRequired,
          type: 'scraping',
          description: `Sales Navigator scraping: ${actualInserted} leads from ${pagesToScrape} pages`,
          campaign_id: campaignId
        });

      // Update campaign status and stats
      await supabase
        .from('campaigns')
        .update({ 
          status: 'completed',
          total_leads: actualInserted,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      // Queue enrichment jobs for leads with profile URLs
      const leadsToEnrich = insertedLeads?.filter(lead => lead.linkedin_url) || [];
      
      if (leadsToEnrich.length > 0) {
        console.log(`[LinkedInTrigger] Queueing ${leadsToEnrich.length} leads for enrichment`);
        
                 for (const lead of leadsToEnrich) {
           try {
             // Import the EnrichmentProcessor class and use the static method
             const { EnrichmentProcessor } = await import('../../../cron/enrichmentProcessor');
             await (EnrichmentProcessor as any).queueJob(
               lead.id,
               userId,
               lead.linkedin_url,
               5 // Normal priority
             );
           } catch (enrichError) {
             console.error(`[LinkedInTrigger] Failed to queue enrichment for lead ${lead.id}:`, enrichError);
           }
         }
      }

      console.log(`[LinkedInTrigger] Successfully completed Sales Navigator scraping for campaign ${campaignId}`);

      res.json({
        success: true,
        message: `Successfully scraped ${actualInserted} leads from Sales Navigator`,
        data: {
          campaignId,
          totalLeads: actualInserted,
          pagesScraped: pagesToScrape,
          creditsUsed: creditsRequired,
          remainingCredits: user.scraping_credits - creditsRequired,
          enrichmentJobsQueued: leadsToEnrich.length
        }
      });

    } catch (scrapingError: any) {
      console.error('[LinkedInTrigger] Scraping failed:', scrapingError);
      
      // Update campaign status to failed
      await supabase
        .from('campaigns')
        .update({ 
          status: 'failed',
          error_message: scrapingError.message || 'Sales Navigator scraping failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      res.status(500).json({ 
        error: 'Sales Navigator scraping failed',
        details: scrapingError.message 
      });
    }

  } catch (error: any) {
    console.error('[LinkedInTrigger] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

export default router; 