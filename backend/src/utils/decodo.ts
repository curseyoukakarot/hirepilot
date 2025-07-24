import axios from 'axios';

const DECODO_API_URL = 'https://scraper-api.smartproxy.com/v1/tasks';
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
    this.apiKey = apiKey || DECODO_API_KEY || '';
    this.baseUrl = DECODO_API_URL;
    
    if (!this.apiKey) {
      throw new Error('Decodo API key is required. Set DECODO_API_KEY environment variable.');
    }
  }

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

    const submitResponse = await this.submitTask(taskRequest);
    const completedTask = await this.pollTask(submitResponse.task_id);
    
    if (!completedTask.html) {
      throw new Error('No HTML content returned from Decodo');
    }

    return completedTask.html;
  }

  /**
   * Scrape Sales Navigator search results
   */
  async scrapeSalesNavigatorSearch(searchUrl: string, page: number = 1): Promise<string> {
    const pageUrl = `${searchUrl}&page=${page}`;
    return this.scrapeUrl(pageUrl, {
      custom_headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
  }

  /**
   * Scrape LinkedIn profile page
   */
  async scrapeLinkedInProfile(profileUrl: string): Promise<string> {
    return this.scrapeUrl(profileUrl, {
      custom_headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
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