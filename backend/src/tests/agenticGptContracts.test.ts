import { JudgeResultsQualitySchema, ProposeQueryVariantsSchema } from '../services/agenticSourcing/gptContracts';

describe('Agentic Sourcing GPT contracts', () => {
  it('validates propose variants shape', () => {
    const payload = {
      variants: [
        {
          rank: 1,
          apollo_params: {
            person_titles: ['VP Sales'],
            person_locations: ['Austin, TX'],
            q_keywords: 'b2b saas',
            page_strategy: { start_page: 1, max_pages: 3 },
          },
          expansion_level: { location: 'metro', titles: 'strict' },
          reason: 'Baseline-like variant',
        },
        {
          rank: 2,
          apollo_params: {
            person_titles: ['Head of Sales'],
            person_locations: ['Texas, US'],
            q_keywords: 'b2b saas',
            page_strategy: { start_page: 2, max_pages: 3 },
          },
          expansion_level: { location: 'state', titles: 'adjacent' },
          reason: 'Broaden location',
        },
        {
          rank: 3,
          apollo_params: {
            person_titles: ['VP Revenue'],
            person_locations: ['United States'],
            q_keywords: 'b2b saas',
            page_strategy: { start_page: 3, max_pages: 2 },
          },
          expansion_level: { location: 'country', titles: 'adjacent' },
          reason: 'Broaden titles + paginate',
        },
      ],
    };
    expect(() => ProposeQueryVariantsSchema.parse(payload)).not.toThrow();
  });

  it('validates judge output shape', () => {
    const payload = {
      quality_score: 72,
      confidence: 0.66,
      decision: 'ACCEPT_RESULTS',
      failure_mode: 'other',
      reasons_good: ['Good geo match'],
      reasons_bad: [],
      recommended_adjustment: { type: 'paginate', notes: 'Try pages 2-3 for more variety.' },
    };
    expect(() => JudgeResultsQualitySchema.parse(payload)).not.toThrow();
  });

  it('rejects invalid judge output', () => {
    const bad = { quality_score: 200, confidence: 2, decision: 'OK', failure_mode: 'x' };
    expect(() => JudgeResultsQualitySchema.parse(bad)).toThrow();
  });
});

