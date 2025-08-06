# Web Content for https://thehirepilot.com/chromeextension/privacy

## Key Updates for New Extension Capabilities

### What's Changed in the Extension
1. **Enhanced Cookie Collection:** Now captures complete LinkedIn document.cookie (not just li_at)
2. **Sales Navigator Lead Scraping:** Added full lead extraction from Sales Navigator search results
3. **Bulk Data Processing:** Handles multiple leads with intelligent scrolling and data extraction

### Privacy Policy Updates Needed

#### Section 1: Information We Collect
**OLD:** Just li_at cookie collection  
**NEW:** Complete LinkedIn cookie collection + Sales Navigator lead data

#### Section 2: Data Processing
**OLD:** Basic authentication  
**NEW:** Authentication + lead data extraction + bulk processing

#### Section 3: User Controls
**OLD:** Simple cookie upload  
**NEW:** Explicit consent for both cookie upload AND lead scraping

## Recommended Web Page Structure

```html
<!-- For /chromeextension/privacy page -->

<h1>Privacy Policy - HirePilot LinkedIn Assistant</h1>

<div class="privacy-overview">
  <h2>What Our Extension Does</h2>
  <ul>
    <li>Securely captures your complete LinkedIn session cookies</li>
    <li>Extracts publicly visible leads from LinkedIn Sales Navigator</li>
    <li>Integrates seamlessly with your HirePilot recruitment platform</li>
  </ul>
</div>

<div class="data-collection">
  <h2>Information We Collect</h2>
  
  <h3>1. LinkedIn Authentication Data</h3>
  <p><strong>What:</strong> Complete LinkedIn session cookies (including li_at, JSESSIONID, and other authentication tokens)</p>
  <p><strong>When:</strong> Only when you click "Upload Full LinkedIn Cookie"</p>
  <p><strong>Why:</strong> To maintain your LinkedIn session and authenticate with HirePilot</p>
  
  <h3>2. Sales Navigator Lead Information</h3>
  <p><strong>What:</strong> Names, titles, companies, locations, and profile URLs from your search results</p>
  <p><strong>When:</strong> Only when you click "Scrape Sales Nav Leads"</p>
  <p><strong>Why:</strong> To import leads into your HirePilot recruitment pipeline</p>
  
  <h3>3. User Authentication</h3>
  <p><strong>What:</strong> Your email and HirePilot authentication tokens</p>
  <p><strong>When:</strong> When you log into the extension</p>
  <p><strong>Why:</strong> To connect with your HirePilot account</p>
</div>

<div class="user-control">
  <h2>Your Control Over Data</h2>
  <ul>
    <li>All data collection requires your explicit action</li>
    <li>No background or automatic data collection</li>
    <li>Uninstall the extension to remove all local data</li>
    <li>Contact support for data access or deletion requests</li>
  </ul>
</div>

<div class="compliance">
  <h2>Compliance & Legal</h2>
  <p>We comply with LinkedIn's Terms of Service by only accessing publicly visible information and respecting rate limits. Users remain responsible for their own LinkedIn compliance.</p>
  
  <p>Data processing complies with GDPR, CCPA, and other applicable privacy laws.</p>
</div>

<div class="contact">
  <h2>Questions?</h2>
  <p>Contact us at <a href="mailto:privacy@thehirepilot.com">privacy@thehirepilot.com</a></p>
</div>
```

## Key Legal Points to Emphasize

### 1. Explicit Consent
- All actions require user clicks
- No background data collection
- Clear purpose for each data type

### 2. Data Minimization
- Only collects publicly visible LinkedIn data
- Only necessary authentication information
- No tracking or analytics beyond core functionality

### 3. User Rights
- Full control over when data is collected
- Easy removal (uninstall extension)
- Access to collected data through HirePilot account

### 4. LinkedIn Compliance
- Respects LinkedIn Terms of Service
- Only public profile information
- Human-like interaction patterns

### 5. Security
- HTTPS encryption for all data transmission
- Secure local storage in browser
- Direct communication with HirePilot only

## Implementation Notes

1. **Update Website:** Replace content at `/chromeextension/privacy` with new privacy policy
2. **Add Terms Page:** Create `/chromeextension/terms` with terms of service
3. **Link in Extension:** Update extension to link to new privacy policy URL
4. **Version Date:** Use January 2025 as effective date
5. **Legal Review:** Consider having legal team review before publishing

## Contact Information to Include
- **Privacy Questions:** privacy@thehirepilot.com
- **Technical Support:** support@thehirepilot.com  
- **General:** contact@thehirepilot.com