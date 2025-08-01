import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Updated default Decodo endpoint (supports both old /v1/tasks and new /v2/scrape)
// The new v2 endpoint returns the HTML payload synchronously – no polling required.
const DECODO_API_URL = process.env.DECODO_API_URL || 'https://scraper-api.decodo.com/v2/scrape';
const DECODO_API_KEY = process.env.DECODO_API_KEY;

export interface DecodoTaskRequest {
  url: string;
  render: boolean;
  geo: string;
  proxy_type: string;
  user_agent: string;
  custom_headers?: Record<string, string>;
  cookies?: string;
}

export interface DecodoTaskResponse {
  task_id: string;
  url: string;
  status: string;
  html?: string;
  data?: any;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export class DecodoClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    const rawKey = apiKey || DECODO_API_KEY || '';
    // If key looks like username:password (contains colon and is not base64), encode it
    if (rawKey.includes(':')) {
      this.apiKey = Buffer.from(rawKey).toString('base64');
    } else {
      this.apiKey = rawKey;
    }
    this.baseUrl = DECODO_API_URL;
    
    if (!this.apiKey) {
      throw new Error('Decodo API key is required. Set DECODO_API_KEY environment variable.');
    }

    // Proxy credentials (gate.decodo.com) if using direct proxy mode
    this.proxyHost = process.env.DECODO_HOST || 'gate.decodo.com';
    this.proxyPort = Number(process.env.DECODO_PORT || '10001');
    this.proxyUser = process.env.DECODO_USER || '';
    this.proxyPass = process.env.DECODO_PASS || '';
  }

  private proxyHost: string;
  private proxyPort: number;
  private proxyUser: string;
  private proxyPass: string;

  /**
   * Submit a scraping task to Decodo
   */
  async submitTask(request: DecodoTaskRequest): Promise<DecodoTaskResponse> {
    try {
      console.log(`[DecodoClient] Submitting task for URL: ${request.url}`);

      const response = await axios.post(this.baseUrl, request, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const result: DecodoTaskResponse = response.data;
      console.log(`[DecodoClient] Task submitted successfully: ${result.task_id}`);
      
      return result;
    } catch (error: any) {
      console.error('[DecodoClient] Error submitting task:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(`Failed to submit Decodo task: ${error.message}`);
    }
  }

  /**
   * Poll a task until completion with exponential backoff
   */
  async pollTask(taskId: string, maxAttempts: number = 30): Promise<DecodoTaskResponse> {
    console.log(`[DecodoClient] Polling task ${taskId} for completion...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${this.baseUrl}/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 10000
        });

        const result: DecodoTaskResponse = response.data;
        console.log(`[DecodoClient] Attempt ${attempt}/${maxAttempts} - Status: ${result.status}`);

        if (result.status === 'completed') {
          console.log(`[DecodoClient] Task ${taskId} completed successfully`);
          return result;
        } else if (result.status === 'failed') {
          throw new Error(`Decodo task failed: ${result.error || 'Unknown error'}`);
        }

        // Wait before next poll (exponential backoff)
        const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error: any) {
        if (attempt === maxAttempts) {
          console.error('[DecodoClient] Max attempts reached:', error.message);
          throw new Error(`Failed to complete Decodo task after ${maxAttempts} attempts`);
        }
        
        console.warn(`[DecodoClient] Attempt ${attempt} failed, retrying:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error(`Decodo task ${taskId} did not complete within ${maxAttempts} attempts`);
  }

  /**
   * Check if the configured endpoint is the new synchronous scrape endpoint.
   */
  private _isInstantEndpoint(): boolean {
    return this.baseUrl.includes('/v2/scrape');
  }

  /**
   * Submit and wait for a scraping task to complete
   */
  async scrapeUrl(url: string, options: Partial<DecodoTaskRequest> = {}): Promise<string> {
    const taskRequest: DecodoTaskRequest = {
      url,
      render: true,
      geo: "us",
      proxy_type: "residential",
      user_agent: "desktop",
      ...options
    };

    // If proxy creds are available, prefer proxy mode (more reliable for LinkedIn)
    if (this.proxyUser && this.proxyPass) {
      try {
        console.log('[DecodoClient] Fetching via residential proxy', `${this.proxyHost}:${this.proxyPort}`);
        const proxyUrl = `http://${this.proxyUser}:${this.proxyPass}@${this.proxyHost}:${this.proxyPort}`;
        const agent = new HttpsProxyAgent(proxyUrl);

        const response = await axios.get(url, {
          headers: {
            ...options.custom_headers,
            'User-Agent': taskRequest.user_agent || 'Mozilla/5.0 (HirePilotBot)'
          },
          httpsAgent: agent,
          proxy: false, // disable axios default proxy handling
          timeout: 30000,
          responseType: 'text',
          validateStatus: status => status < 500
        });

        if (response.status >= 400) {
          throw new Error(`Proxy fetch failed with status ${response.status}`);
        }

        return response.data as string;
      } catch (proxyErr: any) {
        console.error('[DecodoClient] Proxy scraping failed:', proxyErr.message);
        throw proxyErr;
      }
    }

    // Fallback: use Decodo scraping API if proxy creds absent
    if (this._isInstantEndpoint()) {
      try {
        const response = await axios.post(this.baseUrl, taskRequest, {
          headers: {
            'Authorization': `Basic ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        const html = response.data?.html || response.data?.data || response.data;
        if (!html) throw new Error('No HTML content returned from Decodo');
        return html as string;
      } catch (err: any) {
        throw new Error(`Decodo scrape failed: ${err.message}`);
      }
    }

    // Legacy /v1/tasks flow – keep for backward compatibility
    const submitResponse = await this.submitTask(taskRequest);
    const completedTask = await this.pollTask(submitResponse.task_id);

    if (!completedTask.html) {
      throw new Error('No HTML content returned from Decodo');
    }

    return completedTask.html;
  }

  /**
   * Scrape Sales Navigator search results with LinkedIn authentication
   */
  async scrapeSalesNavigatorSearch(searchUrl: string, page: number = 1, linkedinCookie?: string): Promise<string> {
    const pageUrl = `${searchUrl}&page=${page}`;
    
    const customHeaders: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    // Add LinkedIn authentication cookie if provided
    if (linkedinCookie) {
      customHeaders['Cookie'] = `li_at=${linkedinCookie}`;
      console.log('[DecodoClient] Using LinkedIn authentication for Sales Navigator scraping');
    } else {
      console.warn('[DecodoClient] No LinkedIn cookie provided - scraping may be limited to public content');
    }

    return this.scrapeUrl(pageUrl, {
      custom_headers: customHeaders
    });
  }

  /**
   * Scrape LinkedIn profile page with LinkedIn authentication
   */
  async scrapeLinkedInProfile(profileUrl: string, linkedinCookie?: string): Promise<string> {
    const customHeaders: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    // Add LinkedIn authentication cookie if provided
    if (linkedinCookie) {
      customHeaders['Cookie'] = `li_at=${linkedinCookie}`;
      console.log('[DecodoClient] Using LinkedIn authentication for profile scraping');
    } else {
      console.warn('[DecodoClient] No LinkedIn cookie provided - scraping public profile only');
    }

    return this.scrapeUrl(profileUrl, {
      custom_headers: customHeaders
    });
  }

  /**
   * Get task status without waiting
   */
  async getTaskStatus(taskId: string): Promise<DecodoTaskResponse> {
    const response = await axios.get(`${this.baseUrl}/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      timeout: 10000
    });

    return response.data;
  }
}

// Lazy singleton instance - only created when first accessed
let _decodoClient: DecodoClient | null = null;

export const getDecodoClient = (): DecodoClient => {
  if (!_decodoClient) {
    _decodoClient = new DecodoClient();
  }
  return _decodoClient;
}; 