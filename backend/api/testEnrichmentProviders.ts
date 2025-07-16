import { Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { enrichWithHunter } from '../services/hunter/enrichLead';
import { enrichWithSkrapp } from '../services/skrapp/enrichLead';
import { getUserIntegrations } from '../utils/userIntegrationsHelper';
import { enrichWithApollo } from '../src/services/apollo/enrichLead';

/**
 * Test endpoint for enrichment providers
 * POST /api/test/enrichment-providers
 * 
 * Body:
 * {
 *   "fullName": "John Doe",
 *   "domain": "example.com",
 *   "provider": "hunter" | "skrapp" | "both" | "prioritized",
 *   "leadId"?: "uuid" // For testing the full enrichment pipeline
 * }
 */
export default async function testEnrichmentProviders(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { fullName, domain, provider = 'both', leadId } = req.body;

    if (!fullName || !domain) {
      res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['fullName', 'domain']
      });
      return;
    }

    // Get user's integrations (API keys)
    const integrations = await getUserIntegrations(userId);

    const results: any = {};

    // Test prioritized enrichment pipeline if requested
    if (provider === 'prioritized' && leadId) {
      console.log('[Test] Testing prioritized enrichment pipeline...');
      const start = Date.now();
      
      try {
        const enrichmentResult = await enrichWithApollo({
          leadId,
          userId,
          firstName: fullName.split(' ')[0],
          lastName: fullName.split(' ').slice(1).join(' '),
          company: domain.split('.')[0] // Use domain as company for testing
        });
        
        results.prioritized = {
          success: enrichmentResult.success,
          provider: enrichmentResult.provider,
          data: enrichmentResult.data,
          duration: Date.now() - start,
          pipeline: 'hunter → skrapp → apollo'
        };
      } catch (error) {
        results.prioritized = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - start,
          pipeline: 'hunter → skrapp → apollo'
        };
      }
    }

    // Test Hunter.io if requested and API key available
    if ((provider === 'hunter' || provider === 'both') && integrations.hunter_api_key) {
      console.log('[Test] Testing Hunter.io enrichment...');
      const start = Date.now();
      
      try {
        const hunterEmail = await enrichWithHunter(
          integrations.hunter_api_key, 
          fullName, 
          domain
        );
        
        results.hunter = {
          success: !!hunterEmail,
          email: hunterEmail,
          duration: Date.now() - start,
          provider: 'hunter.io'
        };
      } catch (error) {
        results.hunter = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - start,
          provider: 'hunter.io'
        };
      }
    } else if (provider === 'hunter' || provider === 'both') {
      results.hunter = {
        success: false,
        error: 'Hunter.io API key not configured',
        provider: 'hunter.io'
      };
    }

    // Test Skrapp.io if requested and API key available
    if ((provider === 'skrapp' || provider === 'both') && integrations.skrapp_api_key) {
      console.log('[Test] Testing Skrapp.io enrichment...');
      const start = Date.now();
      
      try {
        const skrappEmail = await enrichWithSkrapp(
          integrations.skrapp_api_key, 
          fullName, 
          domain
        );
        
        results.skrapp = {
          success: !!skrappEmail,
          email: skrappEmail,
          duration: Date.now() - start,
          provider: 'skrapp.io'
        };
      } catch (error) {
        results.skrapp = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - start,
          provider: 'skrapp.io'
        };
      }
    } else if (provider === 'skrapp' || provider === 'both') {
      results.skrapp = {
        success: false,
        error: 'Skrapp.io API key not configured',
        provider: 'skrapp.io'
      };
    }

    // Summary
    const successfulProviders = Object.values(results).filter((r: any) => r.success);
    const summary = {
      input: { fullName, domain, provider },
      totalProviders: Object.keys(results).length,
      successfulProviders: successfulProviders.length,
      enrichmentFound: successfulProviders.length > 0,
      bestResult: successfulProviders[0] || null
    };

    res.status(200).json({
      summary,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Test] Enrichment providers test error:', error);
    res.status(500).json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 