/**
 * Proxy Testing Service
 * Tests proxy functionality by attempting LinkedIn access via Puppeteer
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { supabase } from '../../lib/supabase';

interface ProxyTestResult {
  success: boolean;
  response_time_ms: number;
  status_code?: number;
  error_type?: 'timeout' | 'blocked' | 'network_error' | 'captcha' | 'banned' | 'other';
  error_message?: string;
  details: {
    page_title?: string;
    final_url?: string;
    ip_address?: string;
    user_agent: string;
    screenshot_url?: string;
  };
  timestamp: string;
}

interface ProxyDetails {
  id: string;
  endpoint: string;
  username: string;
  password: string;
  provider: string;
  country_code: string;
}

export class ProxyTestingService {
  
  /**
   * Main proxy testing function
   * Tests proxy by attempting to load LinkedIn
   */
  static async testProxy(proxyId: string): Promise<ProxyTestResult> {
    const startTime = Date.now();
    let browser: Browser | null = null;
    
    try {
      console.log(`🧪 Testing proxy: ${proxyId}`);
      
      // Get proxy details
      const proxyDetails = await this.getProxyDetails(proxyId);
      if (!proxyDetails) {
        throw new Error(`Proxy ${proxyId} not found`);
      }
      
      // Configure Puppeteer with proxy
      browser = await this.launchBrowserWithProxy(proxyDetails);
      
      // Test LinkedIn access
      const testResult = await this.testLinkedInAccess(browser);
      
      const responseTime = Date.now() - startTime;
      
      // Record test result in database
      await this.recordTestResult(proxyId, true, responseTime, testResult);
      
      console.log(`✅ Proxy test completed successfully in ${responseTime}ms`);
      
      return {
        success: true,
        response_time_ms: responseTime,
        status_code: testResult.status_code,
        details: testResult.details,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ Proxy test failed:`, error);
      
      const errorType = this.categorizeError(error);
      
      // Record failed test result
      await this.recordTestResult(proxyId, false, responseTime, null, errorType, error);
      
      return {
        success: false,
        response_time_ms: responseTime,
        error_type: errorType,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timestamp: new Date().toISOString()
      };
      
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
    }
  }
  
  /**
   * Get proxy details from database
   */
  static async getProxyDetails(proxyId: string): Promise<ProxyDetails | null> {
    try {
      const { data, error } = await supabase
        .from('proxy_pool')
        .select('id, endpoint, username, password, provider, country_code')
        .eq('id', proxyId)
        .single();
      
      if (error) {
        throw new Error(`Failed to get proxy details: ${error.message}`);
      }
      
      return data;
      
    } catch (error) {
      console.error(`❌ Error getting proxy details:`, error);
      return null;
    }
  }
  
  /**
   * Launch browser with proxy configuration
   */
  static async launchBrowserWithProxy(proxy: ProxyDetails): Promise<Browser> {
    // Parse endpoint for server configuration
    let proxyServer: string;
    if (proxy.endpoint.includes('://')) {
      proxyServer = proxy.endpoint;
    } else if (proxy.endpoint.includes(':')) {
      proxyServer = `http://${proxy.endpoint}`;
    } else {
      proxyServer = `http://${proxy.endpoint}:8080`; // default port
    }
    
    const browser = await puppeteer.launch({
      headless: true, // Always headless for testing
      args: [
        `--proxy-server=${proxyServer}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      defaultViewport: { width: 1366, height: 768 }
    });
    
    // Set up proxy authentication
    const pages = await browser.pages();
    for (const page of pages) {
      if (proxy.username && proxy.password) {
        await page.authenticate({
          username: proxy.username,
          password: proxy.password
        });
      }
    }
    
    return browser;
  }
  
  /**
   * Test LinkedIn access through proxy
   */
  static async testLinkedInAccess(browser: Browser): Promise<{
    status_code?: number;
    details: {
      page_title?: string;
      final_url?: string;
      ip_address?: string;
      user_agent: string;
      screenshot_url?: string;
    };
  }> {
    const page = await browser.newPage();
    
    // Set realistic user agent
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);
    
    try {
      console.log('🔗 Attempting to load LinkedIn...');
      
      // Navigate to LinkedIn with timeout
      const response = await page.goto('https://www.linkedin.com', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Wait a moment for any redirects or dynamic content (Puppeteer v22 removed waitForTimeout)
      await new Promise((r) => setTimeout(r, 3000));
      
      // Get page details
      const pageTitle = await page.title();
      const finalUrl = page.url();
      
      // Check for security challenges or blocks
      const securityIssues = await this.detectSecurityIssues(page);
      if (securityIssues.detected) {
        throw new Error(`Security issue detected: ${securityIssues.type}`);
      }
      
      // Get actual IP address used
      const ipAddress = await this.getActualIPAddress(page);
      
      // Take screenshot for verification
      const screenshot = await page.screenshot({ 
        path: `proxy-test-${Date.now()}.png`,
        fullPage: false 
      });
      
      console.log('✅ LinkedIn loaded successfully');
      console.log(`   Title: ${pageTitle}`);
      console.log(`   URL: ${finalUrl}`);
      console.log(`   IP: ${ipAddress}`);
      
      return {
        status_code: response?.status(),
        details: {
          page_title: pageTitle,
          final_url: finalUrl,
          ip_address: ipAddress,
          user_agent: userAgent,
          screenshot_url: `proxy-test-${Date.now()}.png`
        }
      };
      
    } catch (error) {
      console.error('LinkedIn access test failed:', error);
      throw error;
    } finally {
      await page.close();
    }
  }
  
  /**
   * Detect security issues on the page
   */
  static async detectSecurityIssues(page: Page): Promise<{
    detected: boolean;
    type?: string;
  }> {
    const securitySelectors = {
      captcha: '[data-test-id="captcha-internal"], .captcha-container, #captcha, iframe[src*="captcha"]',
      blocked: '.blocked-page, .access-denied, .error-page',
      rate_limited: '.rate-limit, .too-many-requests',
      geo_blocked: '.geo-block, .region-block',
      challenge: '.challenge-page, .security-challenge'
    };
    
    for (const [type, selector] of Object.entries(securitySelectors)) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`🚨 Security issue detected: ${type}`);
          return { detected: true, type };
        }
      } catch (e) {
        // Selector error, continue checking
      }
    }
    
    // Check page content for common block messages
    try {
      const pageContent = await page.content();
      const blockIndicators = [
        'access denied',
        'blocked',
        'captcha',
        'security check',
        'too many requests',
        'rate limit'
      ];
      
      for (const indicator of blockIndicators) {
        if (pageContent.toLowerCase().includes(indicator)) {
          console.log(`🚨 Block indicator found in content: ${indicator}`);
          return { detected: true, type: indicator.replace(' ', '_') };
        }
      }
    } catch (e) {
      // Content check error, not critical
    }
    
    return { detected: false };
  }
  
  /**
   * Get actual IP address being used
   */
  static async getActualIPAddress(page: Page): Promise<string | undefined> {
    try {
      // Try multiple IP checking services
      const ipServices = [
        'https://api.ipify.org?format=json',
        'https://httpbin.org/ip',
        'https://api.myip.com'
      ];
      
      for (const service of ipServices) {
        try {
          const ipPage = await page.browser().newPage();
          await ipPage.goto(service, { timeout: 10000 });
          
          const content = await ipPage.content();
          await ipPage.close();
          
          // Parse IP from different service formats
          let ipMatch = content.match(/"ip":"([^"]+)"/);
          if (!ipMatch) {
            ipMatch = content.match(/"origin":"([^"]+)"/);
          }
          if (!ipMatch) {
            ipMatch = content.match(/(\d+\.\d+\.\d+\.\d+)/);
          }
          
          if (ipMatch) {
            return ipMatch[1];
          }
        } catch (e) {
          // Try next service
          continue;
        }
      }
      
      return undefined;
      
    } catch (error) {
      console.error('Error getting IP address:', error);
      return undefined;
    }
  }
  
  /**
   * Categorize error type for better reporting
   */
  static categorizeError(error: any): 'timeout' | 'blocked' | 'network_error' | 'captcha' | 'banned' | 'other' {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('navigation timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('captcha') || errorMessage.includes('challenge')) {
      return 'captcha';
    }
    if (errorMessage.includes('blocked') || errorMessage.includes('access denied')) {
      return 'blocked';
    }
    if (errorMessage.includes('banned') || errorMessage.includes('forbidden')) {
      return 'banned';
    }
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'network_error';
    }
    
    return 'other';
  }
  
  /**
   * Record test result in database
   */
  static async recordTestResult(
    proxyId: string,
    success: boolean,
    responseTimeMs: number,
    testDetails: any,
    errorType?: string,
    error?: any
  ): Promise<void> {
    try {
      // Insert into proxy test history
      const { error: insertError } = await supabase
        .from('proxy_test_history')
        .insert({
          proxy_id: proxyId,
          test_type: 'linkedin_access',
          success: success,
          response_time_ms: responseTimeMs,
          error_type: errorType,
          error_message: error instanceof Error ? error.message : null,
          test_details: testDetails || {},
          tested_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Failed to record test result:', insertError);
      }
      
      // Update proxy pool last test info
      await supabase
        .from('proxy_pool')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_success: success,
          updated_at: new Date().toISOString()
        })
        .eq('id', proxyId);
      
    } catch (error) {
      console.error('Error recording test result:', error);
    }
  }
  
  /**
   * Batch test multiple proxies
   */
  static async batchTestProxies(proxyIds: string[]): Promise<Record<string, ProxyTestResult>> {
    const results: Record<string, ProxyTestResult> = {};
    
    console.log(`🧪 Starting batch test for ${proxyIds.length} proxies...`);
    
    // Test proxies in parallel (with concurrency limit)
    const concurrency = 3;
    const chunks = [];
    
    for (let i = 0; i < proxyIds.length; i += concurrency) {
      chunks.push(proxyIds.slice(i, i + concurrency));
    }
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (proxyId) => {
        try {
          const result = await this.testProxy(proxyId);
          results[proxyId] = result;
        } catch (error) {
          console.error(`Batch test failed for proxy ${proxyId}:`, error);
          results[proxyId] = {
            success: false,
            response_time_ms: 0,
            error_type: 'other',
            error_message: error instanceof Error ? error.message : 'Batch test failed',
            details: { user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timestamp: new Date().toISOString()
          };
        }
      });
      
      await Promise.all(chunkPromises);
      
      // Small delay between chunks to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`✅ Batch test completed for ${proxyIds.length} proxies`);
    return results;
  }
  
  /**
   * Get proxy test history
   */
  static async getProxyTestHistory(proxyId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('proxy_test_history')
        .select('*')
        .eq('proxy_id', proxyId)
        .order('tested_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw new Error(`Failed to get test history: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error('Error getting proxy test history:', error);
      return [];
    }
  }
} 