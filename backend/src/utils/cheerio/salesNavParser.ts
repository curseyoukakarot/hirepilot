import * as cheerio from 'cheerio';

export interface SalesNavLead {
  name: string;
  title: string;
  company: string;
  location: string;
  profileUrl: string;
  image?: string;
  connectionDegree?: string;
  isLinkedInMember?: boolean;
}

export interface LinkedInProfile {
  headline?: string;
  summary?: string;
  location?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration?: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
    duration?: string;
  }>;
  skills?: string[];
  email?: string;
  phone?: string;
  languages?: string[];
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
}

/**
 * Parse LinkedIn Sales Navigator search results HTML
 */
export function parseSalesNavigatorSearchResults(html: string): SalesNavLead[] {
  const $ = cheerio.load(html);
  const leads: SalesNavLead[] = [];

  console.log('[SalesNavParser] Starting to parse Sales Navigator search results...');

  // Multiple selectors for different Sales Navigator layouts
  const searchResultSelectors = [
    '.artdeco-entity-lockup',
    '.search-results__result-item',
    '.result-lockup',
    '.entity-result',
    '.search-result',
    '.people-search-result'
  ];

  let foundResults = false;

  for (const selector of searchResultSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`[SalesNavParser] Found ${elements.length} results using selector: ${selector}`);
      foundResults = true;

      elements.each((index, element) => {
        try {
          const $element = $(element);
          const lead = parseSingleSalesNavResult($element);
          
          if (lead && lead.name && (lead.title || lead.company)) {
            leads.push(lead);
          }
        } catch (error) {
          console.error('[SalesNavParser] Error parsing individual result:', error);
        }
      });
      
      break; // Use the first selector that finds results
    }
  }

  if (!foundResults) {
    console.warn('[SalesNavParser] No search results found with any known selectors');
    // Try to find any potential lead containers
    $('.artdeco-card, .search-result, [data-test-id*="result"]').each((index, element) => {
      if (index < 5) { // Limit debugging output
        console.log(`[SalesNavParser] Found potential container ${index}:`, $(element).attr('class'));
      }
    });
  }

  console.log(`[SalesNavParser] Successfully extracted ${leads.length} leads`);
  return leads;
}

/**
 * Parse a single Sales Navigator search result element
 */
function parseSingleSalesNavResult($element: any): SalesNavLead | null {
  // Extract name - try multiple possible selectors
  const nameSelectors = [
    '.artdeco-entity-lockup__title a',
    '.result-lockup__name a',
    '.search-result__result-link',
    '.actor-name',
    '.entity-result__title-text a',
    '.app-aware-link .artdeco-entity-lockup__title',
    '.member-name'
  ];
  
  let name = '';
  let profileUrl = '';
  
  for (const selector of nameSelectors) {
    const nameElement = $element.find(selector).first();
    if (nameElement.length > 0) {
      name = nameElement.text().trim();
      const href = nameElement.attr('href');
      if (href) {
        profileUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
      }
      if (name) break;
    }
  }

  // Extract title
  const titleSelectors = [
    '.artdeco-entity-lockup__subtitle',
    '.result-lockup__highlight-keyword',
    '.search-result__truncate',
    '.subline-level-1',
    '.entity-result__primary-subtitle',
    '.member-title'
  ];
  
  let title = '';
  for (const selector of titleSelectors) {
    title = $element.find(selector).first().text().trim();
    if (title) break;
  }

  // Extract company
  const companySelectors = [
    '.artdeco-entity-lockup__caption',
    '.result-lockup__position-company',
    '.subline-level-2',
    '.entity-result__secondary-subtitle',
    '.search-result__result-link[href*="/company/"]',
    '.member-company'
  ];
  
  let company = '';
  for (const selector of companySelectors) {
    const companyElement = $element.find(selector).first();
    company = companyElement.text().trim();
    
    // If it's a link to a company, extract the company name
    if (companyElement.attr('href')?.includes('/company/') && company) {
      break;
    }
    if (company && !company.includes('at ')) break;
  }

  // Clean up company name (remove "at" prefix if present)
  company = company.replace(/^at\s+/i, '').trim();

  // Extract location
  const locationSelectors = [
    '.artdeco-entity-lockup__metadata',
    '.result-lockup__misc-item',
    '.subline-level-1 .visually-hidden',
    '.entity-result__location',
    '.member-location'
  ];
  
  let location = '';
  for (const selector of locationSelectors) {
    const locationText = $element.find(selector).text().trim();
    // Look for location patterns (city, state, country)
    if (locationText && (locationText.includes(',') || locationText.includes('Area') || locationText.includes('Region') || locationText.length < 50)) {
      location = locationText;
      break;
    }
  }

  // Extract image
  const imageSelectors = [
    '.artdeco-entity-lockup__image img',
    '.result-lockup__image img',
    '.presence-entity__image img',
    '.entity-result__image img',
    '.member-image img'
  ];
  
  let image = '';
  for (const selector of imageSelectors) {
    const src = $element.find(selector).attr('src');
    if (src && !src.includes('data:image')) {
      image = src;
      break;
    }
  }

  // Extract connection degree
  let connectionDegree = '';
  const connectionElements = $element.find('.entity-result__badge, .connection-degree, .member-connection');
  if (connectionElements.length > 0) {
    connectionDegree = connectionElements.first().text().trim();
  }

  // Only return lead if we have at least name and either title or company
  if (name && (title || company)) {
    return {
      name,
      title: title || '',
      company: company || '',
      location: location || '',
      profileUrl: profileUrl || '',
      image: image || '',
      connectionDegree: connectionDegree || '',
      isLinkedInMember: true
    };
  }

  return null;
}

/**
 * Parse LinkedIn profile page HTML to extract detailed profile information
 */
export function parseLinkedInProfile(html: string): LinkedInProfile {
  const $ = cheerio.load(html);
  const profile: LinkedInProfile = {};

  try {
    // Extract headline
    const headlineSelectors = [
      '.text-heading-xlarge',
      '.top-card-layout__headline',
      '.pv-text-details__headline',
      '.text-heading-large'
    ];
    
    for (const selector of headlineSelectors) {
      const headline = $(selector).first().text().trim();
      if (headline) {
        profile.headline = headline;
        break;
      }
    }

    // Extract summary/about
    const summarySelectors = [
      '.pv-about__summary-text',
      '.summary .pv-entity__summary-info',
      '.about .pv-shared-text-with-see-more__text',
      '.pv-about-section .pv-about__summary-text'
    ];
    
    for (const selector of summarySelectors) {
      const summary = $(selector).first().text().trim();
      if (summary && summary.length > 10) {
        profile.summary = summary;
        break;
      }
    }

    // Extract location
    const locationSelectors = [
      '.text-body-small.inline.t-black--light.break-words',
      '.pv-text-details__left-panel .geo-region',
      '.location .geo-region',
      '.top-card__subline-item'
    ];
    
    for (const selector of locationSelectors) {
      const location = $(selector).first().text().trim();
      if (location && !location.includes('@') && location.length > 2) {
        profile.location = location;
        break;
      }
    }

    // Extract experience
    const experience: typeof profile.experience = [];
    const experienceSelectors = [
      '.artdeco-list__item .pvs-entity',
      '.pv-entity__summary-info',
      '.experience-section .pv-entity__summary-info'
    ];
    
    for (const selector of experienceSelectors) {
      $(selector).each((index, element) => {
        if (index >= 5) return false; // Limit to 5 most recent
        
        const $el = $(element);
        const title = $el.find('.t-16.t-black.t-bold, .pv-entity__summary-info-v2 h3, .mr1.hoverable-link-text').first().text().trim();
        const company = $el.find('.t-14.t-black--light, .pv-entity__secondary-title, .pv-entity__secondary-title').first().text().trim();
        const duration = $el.find('.t-14.t-black--light.t-normal, .pv-entity__bullet-item, .pv-entity__bullet-item-v2').first().text().trim();
        
        if (title) {
          experience.push({
            title,
            company: company || '',
            duration: duration || ''
          });
        }
      });
      
      if (experience.length > 0) break;
    }
    profile.experience = experience;

    // Extract education
    const education: typeof profile.education = [];
    const educationSelectors = [
      '.education .pvs-entity',
      '.pv-profile-section__card-item',
      '.education-section .pv-entity__summary-info'
    ];
    
    for (const selector of educationSelectors) {
      $(selector).each((index, element) => {
        if (index >= 3) return false; // Limit to 3 most recent
        
        const $el = $(element);
        const school = $el.find('.t-16.t-black.t-bold, h3, .mr1.hoverable-link-text').first().text().trim();
        const degree = $el.find('.t-14.t-black--light, .pv-entity__secondary-title').first().text().trim();
        
        if (school) {
          education.push({
            school,
            degree: degree || ''
          });
        }
      });
      
      if (education.length > 0) break;
    }
    profile.education = education;

    // Extract skills
    const skills: string[] = [];
    const skillSelectors = [
      '.pvs-skill .t-bold .visually-hidden',
      '.pv-skill-category-entity__name span',
      '.skill-category-entity__name'
    ];
    
    for (const selector of skillSelectors) {
      $(selector).each((index, element) => {
        if (skills.length >= 10) return false; // Limit to 10 skills
        
        const skill = $(element).text().trim();
        if (skill && skill.length > 1 && !skills.includes(skill)) {
          skills.push(skill);
        }
      });
      
      if (skills.length > 0) break;
    }
    profile.skills = skills;

    // Try to extract contact info (usually not publicly available)
    const contactSelectors = [
      '.contact-info .ci-email',
      '.contact-links .contact-info',
      '.pv-contact-info__ci-container'
    ];
    
    for (const selector of contactSelectors) {
      const contactInfo = $(selector).text();
      if (contactInfo.includes('@')) {
        const emailMatch = contactInfo.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
          profile.email = emailMatch[1];
        }
      }
    }

    console.log('[parseLinkedInProfile] Extracted profile data:', {
      hasHeadline: !!profile.headline,
      hasSummary: !!profile.summary,
      hasLocation: !!profile.location,
      experienceCount: profile.experience?.length || 0,
      educationCount: profile.education?.length || 0,
      skillsCount: profile.skills?.length || 0,
      hasEmail: !!profile.email
    });

    return profile;
  } catch (error) {
    console.error('[parseLinkedInProfile] Error parsing profile:', error);
    return {};
  }
} 