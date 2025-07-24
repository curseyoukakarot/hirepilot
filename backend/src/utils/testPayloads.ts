// Test payloads for Decodo Sales Navigator and Enrichment integration

// Mock Sales Navigator search request
export const mockSalesNavScrapingRequest = {
  userId: "test-user-123",
  campaignId: "test-campaign-456", 
  searchUrl: "https://www.linkedin.com/sales/search/people?keywords=software%20engineer&geoUrn=%5B%22103644278%22%5D",
  pagesToScrape: 3
};

// Mock Lead enrichment request
export const mockLeadEnrichmentRequest = {
  leadId: "test-lead-789",
  profileUrl: "https://www.linkedin.com/in/john-doe-software-engineer"
};

// Mock enrichment job queue request
export const mockEnrichmentJobRequest = {
  leadId: "test-lead-789",
  userId: "test-user-123", 
  profileUrl: "https://www.linkedin.com/in/jane-smith-product-manager",
  priority: 8
};

// Mock Sales Navigator HTML response (simplified)
export const mockSalesNavHTML = `
<html>
<head><title>LinkedIn Sales Navigator</title></head>
<body>
  <div class="search-results">
    <div class="artdeco-entity-lockup">
      <div class="artdeco-entity-lockup__image">
        <img src="https://media.licdn.com/dms/image/sample.jpg" alt="Profile photo">
      </div>
      <div class="artdeco-entity-lockup__content">
        <div class="artdeco-entity-lockup__title">
          <a href="/sales/lead/ACwAABKmnABXjRcw">John Doe</a>
        </div>
        <div class="artdeco-entity-lockup__subtitle">
          Senior Software Engineer
        </div>
        <div class="artdeco-entity-lockup__caption">
          Google
        </div>
        <div class="artdeco-entity-lockup__metadata">
          San Francisco Bay Area
        </div>
      </div>
    </div>
    
    <div class="artdeco-entity-lockup">
      <div class="artdeco-entity-lockup__image">
        <img src="https://media.licdn.com/dms/image/sample2.jpg" alt="Profile photo">
      </div>
      <div class="artdeco-entity-lockup__content">
        <div class="artdeco-entity-lockup__title">
          <a href="/sales/lead/ACwAABKmnABXjRcw2">Jane Smith</a>
        </div>
        <div class="artdeco-entity-lockup__subtitle">
          Product Manager
        </div>
        <div class="artdeco-entity-lockup__caption">
          Microsoft
        </div>
        <div class="artdeco-entity-lockup__metadata">
          Seattle, Washington
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Mock LinkedIn profile HTML response (simplified)
export const mockLinkedInProfileHTML = `
<html>
<head><title>John Doe | LinkedIn</title></head>
<body>
  <div class="pv-text-details__headline">
    Senior Software Engineer at Google
  </div>
  
  <div class="pv-about__summary-text">
    Experienced software engineer with 8+ years in full-stack development. 
    Passionate about building scalable web applications and mentoring junior developers.
    Specializing in React, Node.js, and cloud architecture.
  </div>
  
  <div class="geo-region">
    San Francisco Bay Area
  </div>
  
  <div class="experience-section">
    <div class="pv-entity__summary-info">
      <h3>Senior Software Engineer</h3>
      <div class="pv-entity__secondary-title">Google</div>
      <div class="pv-entity__bullet-item">2020 - Present</div>
    </div>
    
    <div class="pv-entity__summary-info">
      <h3>Software Engineer</h3>
      <div class="pv-entity__secondary-title">Facebook</div>
      <div class="pv-entity__bullet-item">2018 - 2020</div>
    </div>
  </div>
  
  <div class="education-section">
    <div class="pv-profile-section__card-item">
      <h3>Stanford University</h3>
      <div class="pv-entity__secondary-title">Bachelor's in Computer Science</div>
    </div>
  </div>
  
  <div class="skills-section">
    <div class="pv-skill-category-entity__name">
      <span>JavaScript</span>
    </div>
    <div class="pv-skill-category-entity__name">
      <span>React</span>
    </div>
    <div class="pv-skill-category-entity__name">
      <span>Node.js</span>
    </div>
  </div>
</body>
</html>
`;

// Mock Decodo API responses
export const mockDecodoTaskResponse = {
  task_id: "test-task-123456",
  url: "https://www.linkedin.com/sales/search/people?keywords=software%20engineer",
  status: "queued",
  created_at: new Date().toISOString()
};

export const mockDecodoCompletedResponse = {
  task_id: "test-task-123456",
  url: "https://www.linkedin.com/sales/search/people?keywords=software%20engineer",
  status: "completed", 
  html: mockSalesNavHTML,
  updated_at: new Date().toISOString()
};

// Mock enrichment API responses
export const mockEnrichmentSuccessResponse = {
  success: true,
  lead: {
    id: "test-lead-789",
    first_name: "John",
    last_name: "Doe", 
    email: "john.doe@example.com",
    title: "Senior Software Engineer",
    company: "Google",
    linkedin_url: "https://www.linkedin.com/in/john-doe-software-engineer",
    location: "San Francisco Bay Area",
    enriched_at: new Date().toISOString(),
    enrichment_source: "decodo"
  },
  enrichment: {
    source: "decodo",
    confidence: 85,
    data: {
      headline: "Senior Software Engineer at Google",
      summary: "Experienced software engineer with 8+ years...",
      location: "San Francisco Bay Area",
      experience: [
        {
          title: "Senior Software Engineer",
          company: "Google",
          duration: "2020 - Present"
        }
      ],
      education: [
        {
          school: "Stanford University", 
          degree: "Bachelor's in Computer Science"
        }
      ],
      skills: ["JavaScript", "React", "Node.js"]
    },
    log: [
      "Step 1: Decodo profile scraping",
      "✅ Decodo: Success - enrichment complete"
    ]
  }
};

export const mockEnrichmentFailureResponse = {
  success: false,
  error: "All enrichment methods failed",
  log: [
    "Step 1: Decodo profile scraping",
    "❌ Decodo: Profile scraping failed",
    "Step 2: Hunter email enrichment", 
    "❌ Hunter: No email found",
    "Step 3: Skrapp email enrichment",
    "❌ Skrapp: API key not configured",
    "Step 4: Apollo final fallback",
    "❌ Apollo: Apollo enrichment failed"
  ]
};

// Mock credit check responses
export const mockInsufficientCreditsResponse = {
  error: "You've run out of enrichment or scraping credits. Upgrade your plan or top up."
};

export const mockCreditCheckSuccess = {
  hasCredits: true,
  remaining: 45,
  total: 100
};

// Test functions for validating responses
export function validateSalesNavScrapingResponse(response: any): boolean {
  return !!(
    response &&
    typeof response.success === 'boolean' &&
    typeof response.numLeads === 'number' &&
    response.numLeads >= 0
  );
}

export function validateEnrichmentResponse(response: any): boolean {
  return !!(
    response &&
    typeof response.success === 'boolean' &&
    (response.success ? response.lead && response.enrichment : response.error)
  );
}

export function validateEnrichmentJobResponse(response: any): boolean {
  return !!(
    response &&
    typeof response.id === 'string' &&
    response.id.length > 0
  );
}

// Helper functions for testing
export function createMockLead(overrides: Partial<any> = {}) {
  return {
    id: "test-lead-" + Math.random().toString(36).substr(2, 9),
    user_id: "test-user-123",
    campaign_id: "test-campaign-456",
    first_name: "John",
    last_name: "Doe",
    name: "John Doe",
    title: "Software Engineer",
    company: "Tech Corp",
    linkedin_url: "https://www.linkedin.com/in/john-doe",
    email: null,
    phone: null,
    location: "San Francisco, CA",
    status: "New",
    source: "sales_navigator",
    enrichment_data: null,
    enriched_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: "test-user-123",
    email: "test@example.com",
    scraping_credits: 50,
    enrichment_credits: 25,
    role: "user",
    created_at: new Date().toISOString(),
    ...overrides
  };
}

export function createMockCampaign(overrides: Partial<any> = {}) {
  return {
    id: "test-campaign-456",
    user_id: "test-user-123", 
    name: "Test Sales Navigator Campaign",
    source: "sales_navigator",
    status: "active",
    total_leads: 0,
    enriched_leads: 0,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

// Integration test scenarios
export const testScenarios = {
  // Successful Sales Navigator scraping
  successfulScraping: {
    request: mockSalesNavScrapingRequest,
    mockHtml: mockSalesNavHTML,
    expectedLeads: 2,
    expectedCreditsDeducted: 3
  },
  
  // Successful lead enrichment via Decodo
  successfulEnrichment: {
    request: mockLeadEnrichmentRequest,
    mockHtml: mockLinkedInProfileHTML,
    expectedSource: "decodo",
    expectedCreditsDeducted: 1
  },
  
  // Failed enrichment (all services fail)
  failedEnrichment: {
    request: mockLeadEnrichmentRequest,
    expectedError: "All enrichment methods failed",
    expectedCreditsDeducted: 0
  },
  
  // Insufficient credits
  insufficientCredits: {
    request: mockSalesNavScrapingRequest,
    userCredits: 0,
    expectedError: "You've run out of enrichment or scraping credits"
  }
};

export default {
  mockSalesNavScrapingRequest,
  mockLeadEnrichmentRequest,
  mockEnrichmentJobRequest,
  mockSalesNavHTML,
  mockLinkedInProfileHTML,
  mockDecodoTaskResponse,
  mockDecodoCompletedResponse,
  mockEnrichmentSuccessResponse,
  mockEnrichmentFailureResponse,
  validateSalesNavScrapingResponse,
  validateEnrichmentResponse,
  validateEnrichmentJobResponse,
  createMockLead,
  createMockUser,
  createMockCampaign,
  testScenarios
}; 