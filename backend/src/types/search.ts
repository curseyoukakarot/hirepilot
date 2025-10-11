export interface CandidateSearchFilters {
  q?: string;                 // free text
  skills?: string[];          // ANY match
  tech?: string[];            // ANY match
  titles?: string[];          // ANY match
  companies?: string[];       // ANY match
  fundingStage?: string[];    // from enrichment table if present
  revenueMin?: number;
  revenueMax?: number;
  location?: string;
  limit?: number;
  offset?: number;
}

export interface LeadSearchFilters {
  q?: string;
  sources?: string[];
  tags?: string[];
  title?: string;
  company?: string;
  limit?: number;
  offset?: number;
}


