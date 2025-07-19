/**
 * Proxy Assignment Service
 * Manages dedicated proxy assignments for users
 */

import { supabase } from '../../lib/supabase';

interface ProxyDetails {
  proxy_id: string;
  endpoint: string;
  port: number;
  username: string;
  password: string;
  provider: string;
  country_code: string;
  status: string;
}

interface UserProxyAssignment {
  id: string;
  user_id: string;
  proxy_id: string;
  active: boolean;
  assigned_at: string;
  last_used_at?: string;
  total_jobs_processed: number;
  successful_jobs: number;
  failed_jobs: number;
  assignment_reason: string;
}

export class ProxyAssignmentService {
  
  /**
   * Assign a proxy to a user (or return existing assignment)
   * This is the main method requested in the prompt
   */
  static async assignProxyToUser(userId: string): Promise<string> {
    try {
      console.log(`🔄 Assigning proxy to user: ${userId}`);
      
      // Call the database function we created
      const { data, error } = await supabase.rpc('assign_proxy_to_user', {
        p_user_id: userId
      });
      
      if (error) {
        throw new Error(`Failed to assign proxy: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('No proxy ID returned from assignment function');
      }
      
      console.log(`✅ Successfully assigned proxy ${data} to user ${userId}`);
      return data;
      
    } catch (error) {
      console.error('❌ Error in assignProxyToUser:', error);
      throw error;
    }
  }
  
  /**
   * Get a user's currently assigned proxy details
   */
  static async getUserProxy(userId: string): Promise<ProxyDetails | null> {
    try {
      console.log(`📡 Getting proxy details for user: ${userId}`);
      
      // Call the database function to get proxy details
      const { data, error } = await supabase.rpc('get_user_proxy', {
        p_user_id: userId
      });
      
      if (error) {
        throw new Error(`Failed to get user proxy: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        console.log(`⚠️ No proxy found for user ${userId}`);
        return null;
      }
      
      const proxy = data[0];
      console.log(`✅ Found proxy ${proxy.proxy_id} for user ${userId}`);
      
      return {
        proxy_id: proxy.proxy_id,
        endpoint: proxy.endpoint,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
        provider: proxy.provider,
        country_code: proxy.country_code,
        status: proxy.status
      };
      
    } catch (error) {
      console.error('❌ Error in getUserProxy:', error);
      throw error;
    }
  }
  
  /**
   * Get user's proxy assignment details
   */
  static async getUserProxyAssignment(userId: string): Promise<UserProxyAssignment | null> {
    try {
      const { data, error } = await supabase
        .from('user_proxy_assignments')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw new Error(`Failed to get proxy assignment: ${error.message}`);
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Error in getUserProxyAssignment:', error);
      throw error;
    }
  }
  
  /**
   * Update performance metrics for a user's proxy assignment
   */
  static async updateAssignmentPerformance(
    userId: string, 
    wasSuccessful: boolean, 
    responseTimeMs?: number
  ): Promise<void> {
    try {
      console.log(`📊 Updating assignment performance for user ${userId}: ${wasSuccessful ? 'SUCCESS' : 'FAILURE'}`);
      
      const { error } = await supabase.rpc('update_assignment_performance', {
        p_user_id: userId,
        p_was_successful: wasSuccessful,
        p_response_time_ms: responseTimeMs
      });
      
      if (error) {
        throw new Error(`Failed to update assignment performance: ${error.message}`);
      }
      
      console.log(`✅ Updated assignment performance for user ${userId}`);
      
    } catch (error) {
      console.error('❌ Error in updateAssignmentPerformance:', error);
      throw error;
    }
  }
  
  /**
   * Reassign a user to a different proxy
   */
  static async reassignUserProxy(userId: string, reason: string = 'rotation'): Promise<string> {
    try {
      console.log(`🔄 Reassigning proxy for user ${userId}, reason: ${reason}`);
      
      const { data, error } = await supabase.rpc('reassign_user_proxy', {
        p_user_id: userId,
        p_reason: reason
      });
      
      if (error) {
        throw new Error(`Failed to reassign proxy: ${error.message}`);
      }
      
      console.log(`✅ Successfully reassigned user ${userId} to proxy ${data}`);
      return data;
      
    } catch (error) {
      console.error('❌ Error in reassignUserProxy:', error);
      throw error;
    }
  }
  
  /**
   * Get available proxies for assignment (admin view)
   */
  static async getAvailableProxies(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('available_proxies_for_assignment')
        .select('*')
        .eq('available_for_assignment', true)
        .order('current_assignments', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to get available proxies: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error('❌ Error in getAvailableProxies:', error);
      throw error;
    }
  }
  
  /**
   * Get all user proxy assignments (admin view)
   */
  static async getAllUserAssignments(): Promise<UserProxyAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('user_proxy_assignments')
        .select(`
          *,
          proxy_pool!inner(
            endpoint,
            provider,
            country_code,
            status
          )
        `)
        .eq('active', true)
        .order('assigned_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to get user assignments: ${error.message}`);
      }
      
      return data || [];
      
    } catch (error) {
      console.error('❌ Error in getAllUserAssignments:', error);
      throw error;
    }
  }
  
  /**
   * Force assign a specific proxy to a user (admin function)
   */
  static async forceAssignProxy(userId: string, proxyId: string, reason: string = 'manual'): Promise<void> {
    try {
      console.log(`🔧 Force assigning proxy ${proxyId} to user ${userId}`);
      
      // Deactivate current assignment
      await supabase
        .from('user_proxy_assignments')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('active', true);
      
      // Create new assignment
      const { error } = await supabase
        .from('user_proxy_assignments')
        .insert({
          user_id: userId,
          proxy_id: proxyId,
          active: true,
          assignment_reason: reason,
          assigned_at: new Date().toISOString()
        });
      
      if (error) {
        throw new Error(`Failed to force assign proxy: ${error.message}`);
      }
      
      // Mark proxy as in use
      await supabase
        .from('proxy_pool')
        .update({ in_use: true })
        .eq('id', proxyId);
      
      console.log(`✅ Successfully force assigned proxy ${proxyId} to user ${userId}`);
      
    } catch (error) {
      console.error('❌ Error in forceAssignProxy:', error);
      throw error;
    }
  }
  
  /**
   * Format proxy for Puppeteer configuration
   */
  static formatProxyForPuppeteer(proxy: ProxyDetails): {
    server: string;
    username: string;
    password: string;
  } {
    // Handle different endpoint formats
    let server: string;
    
    if (proxy.endpoint.includes('://')) {
      // Already has protocol
      server = proxy.endpoint;
    } else if (proxy.endpoint.includes(':')) {
      // Has port
      server = `http://${proxy.endpoint}`;
    } else {
      // Just IP/hostname
      server = `http://${proxy.endpoint}:${proxy.port}`;
    }
    
    return {
      server,
      username: proxy.username,
      password: proxy.password
    };
  }
}

// Export the main function for direct use as requested in the prompt
export async function assignProxyToUser(userId: string): Promise<string> {
  return ProxyAssignmentService.assignProxyToUser(userId);
} 