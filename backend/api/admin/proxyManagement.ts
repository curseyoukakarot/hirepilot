/**
 * API: Admin Proxy Management
 * Comprehensive proxy management endpoints for Super Admin
 */

import { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';
import { ProxyTestingService } from '../../services/puppet/proxyTestingService';
import { ProxyAssignmentService } from '../../services/puppet/proxyAssignmentService';

/**
 * Test proxy functionality
 * POST /api/admin/proxies/test
 */
export const testProxy = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { proxyId } = req.body;
    
    if (!proxyId) {
      return res.status(400).json({ error: 'proxyId is required' });
    }
    
    console.log(`🧪 Admin ${req.user?.email} testing proxy: ${proxyId}`);
    
    // Run proxy test
    const testResult = await ProxyTestingService.testProxy(proxyId);
    
    res.json({
      success: true,
      data: testResult
    });
    
  } catch (error) {
    console.error('Error testing proxy:', error);
    res.status(500).json({ 
      error: 'Failed to test proxy', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get all proxies for admin management
 * GET /api/admin/proxies
 */
export const getAllProxies = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { 
      status, 
      provider, 
      country_code, 
      health_status,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
      limit = 50,
      offset = 0
    } = req.query;
    
    // Build query
    let query = supabase
      .from('proxy_management_view')
      .select('*');
    
    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (provider) {
      query = query.eq('provider', provider);
    }
    
    if (country_code) {
      query = query.eq('country_code', country_code);
    }
    
    if (health_status) {
      query = query.eq('health_status', health_status);
    }
    
    if (search) {
      query = query.or(`endpoint.ilike.%${search}%,assigned_users.ilike.%${search}%`);
    }
    
    // Apply sorting
    const ascending = sort_order === 'asc';
    query = query.order(sort_by as string, { ascending });
    
    // Apply pagination
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);
    
    const { data, error, count } = await query;

    if (error) {
      if (error.message?.includes('does not exist')) {
        // View not created yet – return empty list
        return res.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            limit: Number(limit),
            offset: Number(offset)
          }
        });
      }
      throw new Error(`Failed to get proxies: ${error.message}`);
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        total: count ?? 0,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
    
  } catch (error) {
    console.error('Error getting proxies:', error);
    res.status(500).json({ 
      error: 'Failed to get proxies', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get proxy statistics for dashboard
 * GET /api/admin/proxies/stats
 */
export const getProxyStats = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Get overall statistics
    const { data: stats, error: statsError } = await supabase
      .from('proxy_statistics')
      .select('*')
      .single();
    let safeStats = stats || {};
    if (statsError) {
      if (statsError.message?.includes('does not exist')) {
        safeStats = {};
      } else {
        throw new Error(`Failed to get proxy stats: ${statsError.message}`);
      }
    }
    
    // Get recent test activity (last 24 hours)
    const { data: recentTests, error: testsError } = await supabase
      .from('proxy_test_history')
      .select('success, tested_at')
      .gte('tested_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (testsError) {
      console.error('Error getting recent tests:', testsError);
    }
    
    // Calculate recent test stats
    const recentTestStats = recentTests ? {
      total_tests_24h: recentTests.length,
      successful_tests_24h: recentTests.filter(t => t.success).length,
      failed_tests_24h: recentTests.filter(t => !t.success).length
    } : {
      total_tests_24h: 0,
      successful_tests_24h: 0,
      failed_tests_24h: 0
    };
    
    // Get top performing proxies
    const { data: topProxies, error: topError } = await supabase
      .from('proxy_management_view')
      .select('id, endpoint, provider, success_rate_percent, global_success_count')
      .not('success_rate_percent', 'is', null)
      .order('success_rate_percent', { ascending: false })
      .limit(5);
    
    // Get recent proxy additions
    const { data: recentProxies, error: recentError } = await supabase
      .from('proxy_pool')
      .select('id, endpoint, provider, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    res.json({
      success: true,
      data: {
        ...safeStats,
        ...recentTestStats,
        top_performing_proxies: topProxies || [],
        recent_additions: recentProxies || []
      }
    });
    
  } catch (error) {
    console.error('Error getting proxy stats:', error);
    res.status(500).json({ 
      error: 'Failed to get proxy stats', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get proxy test history
 * GET /api/admin/proxies/:proxyId/history
 */
export const getProxyTestHistory = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { proxyId } = req.params;
    const { limit = 20 } = req.query;
    
    if (!proxyId) {
      return res.status(400).json({ error: 'Proxy ID is required' });
    }
    
    // Get test history
    const history = await ProxyTestingService.getProxyTestHistory(proxyId, Number(limit));
    
    // Get test summary
    const { data: summary, error: summaryError } = await supabase.rpc('get_proxy_test_summary', {
      p_proxy_id: proxyId
    });
    
    res.json({
      success: true,
      data: {
        history,
        summary: summary?.[0] || {
          total_tests: 0,
          successful_tests: 0,
          failed_tests: 0,
          success_rate: 0,
          avg_response_time: 0
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting proxy test history:', error);
    res.status(500).json({ 
      error: 'Failed to get proxy test history', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Update proxy status manually
 * POST /api/admin/proxies/:proxyId/status
 */
export const updateProxyStatus = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { proxyId } = req.params;
    const { status, reason } = req.body;
    
    if (!proxyId || !status) {
      return res.status(400).json({ error: 'proxyId and status are required' });
    }
    
    const validStatuses = ['active', 'inactive', 'maintenance', 'banned', 'testing'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    // Update proxy status
    const { error } = await supabase
      .from('proxy_pool')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', proxyId);
    
    if (error) {
      throw new Error(`Failed to update proxy status: ${error.message}`);
    }
    
    console.log(`✅ Admin ${req.user?.email} updated proxy ${proxyId} status to ${status}`);
    
    res.json({
      success: true,
      message: `Proxy status updated to ${status}`
    });
    
  } catch (error) {
    console.error('Error updating proxy status:', error);
    res.status(500).json({ 
      error: 'Failed to update proxy status', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Reassign proxy to different user
 * POST /api/admin/proxies/:proxyId/reassign
 */
export const reassignProxy = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { proxyId } = req.params;
    const { user_id, reason = 'admin_manual' } = req.body;
    
    if (!proxyId || !user_id) {
      return res.status(400).json({ error: 'proxyId and user_id are required' });
    }
    
    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('auth.users')
      .select('id, email')
      .eq('id', user_id)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Use proxy assignment service to reassign
    await ProxyAssignmentService.forceAssignProxy(user_id, proxyId, reason);
    
    console.log(`✅ Admin ${req.user?.email} reassigned proxy ${proxyId} to user ${user.email}`);
    
    res.json({
      success: true,
      message: `Proxy successfully assigned to ${user.email}`
    });
    
  } catch (error) {
    console.error('Error reassigning proxy:', error);
    res.status(500).json({ 
      error: 'Failed to reassign proxy', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Batch test multiple proxies
 * POST /api/admin/proxies/batch-test
 */
export const batchTestProxies = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { proxy_ids, test_all = false } = req.body;
    
    let proxyIds: string[] = [];
    
    if (test_all) {
      // Get all active proxy IDs
      const { data: proxies, error } = await supabase
        .from('proxy_pool')
        .select('id')
        .eq('status', 'active');
      
      if (error) {
        throw new Error(`Failed to get proxy IDs: ${error.message}`);
      }
      
      proxyIds = proxies?.map(p => p.id) || [];
    } else {
      if (!proxy_ids || !Array.isArray(proxy_ids) || proxy_ids.length === 0) {
        return res.status(400).json({ error: 'proxy_ids array is required when test_all is false' });
      }
      proxyIds = proxy_ids;
    }
    
    if (proxyIds.length === 0) {
      return res.status(400).json({ error: 'No proxies to test' });
    }
    
    if (proxyIds.length > 20) {
      return res.status(400).json({ error: 'Cannot test more than 20 proxies at once' });
    }
    
    console.log(`🧪 Admin ${req.user?.email} starting batch test of ${proxyIds.length} proxies`);
    
    // Start batch test (this runs in background)
    const results = await ProxyTestingService.batchTestProxies(proxyIds);
    
    res.json({
      success: true,
      message: `Batch test completed for ${proxyIds.length} proxies`,
      data: results
    });
    
  } catch (error) {
    console.error('Error batch testing proxies:', error);
    res.status(500).json({ 
      error: 'Failed to batch test proxies', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Add new proxy to pool
 * POST /api/admin/proxies/add
 */
export const addProxy = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const {
      provider,
      endpoint,
      username,
      password,
      country_code,
      region,
      city,
      proxy_type = 'residential',
      max_concurrent_users = 2
    } = req.body;
    
    // Validate required fields
    if (!provider || !endpoint || !username || !password) {
      return res.status(400).json({ 
        error: 'provider, endpoint, username, and password are required' 
      });
    }
    
    // Insert new proxy
    const { data, error } = await supabase
      .from('proxy_pool')
      .insert({
        provider,
        endpoint,
        username,
        password,
        country_code,
        region,
        city,
        proxy_type,
        max_concurrent_users,
        status: 'testing', // Start in testing status
        added_by: req.user?.id
      })
      .select('id')
      .single();
    
    if (error) {
      throw new Error(`Failed to add proxy: ${error.message}`);
    }
    
    console.log(`✅ Admin ${req.user?.email} added new proxy: ${endpoint}`);
    
    res.json({
      success: true,
      message: 'Proxy added successfully',
      data: { proxy_id: data.id }
    });
    
  } catch (error) {
    console.error('Error adding proxy:', error);
    res.status(500).json({ 
      error: 'Failed to add proxy', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Delete proxy from pool
 * DELETE /api/admin/proxies/:proxyId
 */
export const deleteProxy = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { proxyId } = req.params;
    
    if (!proxyId) {
      return res.status(400).json({ error: 'Proxy ID is required' });
    }
    
    // Check if proxy is currently assigned
    const { data: assignments, error: assignError } = await supabase
      .from('user_proxy_assignments')
      .select('user_id')
      .eq('proxy_id', proxyId)
      .eq('active', true);
    
    if (assignError) {
      throw new Error(`Failed to check assignments: ${assignError.message}`);
    }
    
    if (assignments && assignments.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete proxy that is currently assigned to users. Reassign users first.' 
      });
    }
    
    // Delete proxy
    const { error } = await supabase
      .from('proxy_pool')
      .delete()
      .eq('id', proxyId);
    
    if (error) {
      throw new Error(`Failed to delete proxy: ${error.message}`);
    }
    
    console.log(`✅ Admin ${req.user?.email} deleted proxy: ${proxyId}`);
    
    res.json({
      success: true,
      message: 'Proxy deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting proxy:', error);
    res.status(500).json({ 
      error: 'Failed to delete proxy', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}; 