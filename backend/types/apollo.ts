export interface EnrichedPerson {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  email_status: string;
  title: string;
  linkedin_url: string | null;
  city: string;
  state: string;
  country: string;
  confidence_score?: number;
  seniority?: string;
  department?: string;
  skills?: string[];
  location?: string;
  twitter_url?: string;
  facebook_url?: string;
  github_url?: string;
  organization?: {
    id: string;
    name: string;
    website_url?: string;
    estimated_annual_revenue?: string;
    headquarters_location?: string;
    founded_year?: number;
    estimated_num_employees?: number;
    industry?: string;
  };
}

export interface ApolloSearchParams {
  q_organization_domains?: string[];
  q_organization_keywords?: string[];
  q_organization_locations?: string[];
  q_person_titles?: string[];
  q_person_locations?: string[];
  page?: number;
  per_page?: number;
}

export interface ApolloSearchResponse {
  data: {
    people: EnrichedPerson[];
  };
} 