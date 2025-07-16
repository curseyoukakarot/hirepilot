import { enrichWithHunter } from './hunter/enrichLead';
import { enrichWithSkrapp } from './skrapp/enrichLead';

export { enrichWithHunter, enrichWithSkrapp };

/**
 * Enrichment provider types for lead email discovery
 */
export enum EnrichmentProvider {
  HUNTER = 'hunter',
  SKRAPP = 'skrapp',
  APOLLO = 'apollo'
}

/**
 * Enrichment result with metadata
 */
export interface EnrichmentResult {
  email: string | null;
  provider: EnrichmentProvider;
  confidence?: number;
  success: boolean;
  error?: string;
}

/**
 * Try enrichment with prioritized providers
 * @param providers - Array of enrichment attempts to try in order
 * @returns First successful enrichment result
 */
export async function tryEnrichmentProviders(
  providers: Array<{
    provider: EnrichmentProvider;
    apiKey: string;
    fullName: string;
    domain: string;
  }>
): Promise<EnrichmentResult> {
  for (const config of providers) {
    try {
      let email: string | null = null;
      
      switch (config.provider) {
        case EnrichmentProvider.HUNTER:
          email = await enrichWithHunter(config.apiKey, config.fullName, config.domain);
          break;
        case EnrichmentProvider.SKRAPP:
          email = await enrichWithSkrapp(config.apiKey, config.fullName, config.domain);
          break;
        case EnrichmentProvider.APOLLO:
          // Apollo enrichment would be handled separately
          // as it uses a different API pattern
          continue;
        default:
          continue;
      }

      if (email) {
        return {
          email,
          provider: config.provider,
          success: true
        };
      }
    } catch (error) {
      console.error(`[EnrichmentProviders] ${config.provider} enrichment failed:`, error);
      // Continue to next provider
    }
  }

  return {
    email: null,
    provider: EnrichmentProvider.APOLLO, // Will fallback to Apollo
    success: false,
    error: 'All enrichment providers failed'
  };
} 