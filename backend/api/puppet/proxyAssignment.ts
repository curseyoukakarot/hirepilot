/**
 * API: Proxy Assignment Management
 * Handles proxy assignment operations for users
 */

import { Request, Response } from 'express';
import { ProxyAssignmentService } from '../../services/puppet/proxyAssignmentService';

/**
 * Get user's assigned proxy
 * GET /api/puppet/proxy/assigned
 */
export const getUserAssignedProxy = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const proxyDetails = await ProxyAssignmentService.getUserProxy(userId);
    
    if (!proxyDetails) {
      return res.status(404).json({ error: 'No proxy assigned to user' });
    }
    
    // Don't expose sensitive credentials in API response
    const sanitizedProxy = {
      proxy_id: proxyDetails.proxy_id,
      provider: proxyDetails.provider,
      country_code: proxyDetails.country_code,
      status: proxyDetails.status,
      endpoint: proxyDetails.endpoint.split(':')[0] // Only show IP, not port
    };
    
    res.json({
      success: true,
      data: sanitizedProxy
    });
    
  } catch (error) {
    console.error('Error getting user proxy:', error);
    res.status(500).json({ 
      error: 'Failed to get user proxy', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Assign or get proxy for user
 * POST /api/puppet/proxy/assign
 */
export const assignProxyToUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const proxyId = await ProxyAssignmentService.assignProxyToUser(userId);
    
    res.json({
      success: true,
      data: {
        proxy_id: proxyId,
        message: 'Proxy assigned successfully'
      }
    });
    
  } catch (error) {
    console.error('Error assigning proxy:', error);
    res.status(500).json({ 
      error: 'Failed to assign proxy', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get proxy assignment details
 * GET /api/puppet/proxy/assignment
 */
export const getProxyAssignment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const assignment = await ProxyAssignmentService.getUserProxyAssignment(userId);
    
    if (!assignment) {
      return res.status(404).json({ error: 'No proxy assignment found' });
    }
    
    res.json({
      success: true,
      data: assignment
    });
    
  } catch (error) {
    console.error('Error getting proxy assignment:', error);
    res.status(500).json({ 
      error: 'Failed to get proxy assignment', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Request proxy reassignment
 * POST /api/puppet/proxy/reassign
 */
export const reassignProxy = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { reason } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const newProxyId = await ProxyAssignmentService.reassignUserProxy(
      userId, 
      reason || 'user_request'
    );
    
    res.json({
      success: true,
      data: {
        new_proxy_id: newProxyId,
        message: 'Proxy reassigned successfully'
      }
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
 * Update proxy performance (for system use)
 * POST /api/puppet/proxy/performance
 */
export const updateProxyPerformance = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { was_successful, response_time_ms } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (typeof was_successful !== 'boolean') {
      return res.status(400).json({ error: 'was_successful must be a boolean' });
    }
    
    await ProxyAssignmentService.updateAssignmentPerformance(
      userId, 
      was_successful, 
      response_time_ms
    );
    
    res.json({
      success: true,
      message: 'Performance updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating proxy performance:', error);
    res.status(500).json({ 
      error: 'Failed to update proxy performance', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Admin: Get all proxy assignments
 * GET /api/puppet/proxy/admin/assignments
 */
export const getAllProxyAssignments = async (req: Request, res: Response) => {
  try {
    // Check if user is admin (you may need to adjust this based on your auth system)
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const assignments = await ProxyAssignmentService.getAllUserAssignments();
    
    res.json({
      success: true,
      data: assignments
    });
    
  } catch (error) {
    console.error('Error getting all proxy assignments:', error);
    res.status(500).json({ 
      error: 'Failed to get proxy assignments', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Admin: Get available proxies
 * GET /api/puppet/proxy/admin/available
 */
export const getAvailableProxies = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const proxies = await ProxyAssignmentService.getAvailableProxies();
    
    res.json({
      success: true,
      data: proxies
    });
    
  } catch (error) {
    console.error('Error getting available proxies:', error);
    res.status(500).json({ 
      error: 'Failed to get available proxies', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Admin: Force assign proxy to user
 * POST /api/puppet/proxy/admin/force-assign
 */
export const forceAssignProxy = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { user_id, proxy_id, reason } = req.body;
    
    if (!user_id || !proxy_id) {
      return res.status(400).json({ error: 'user_id and proxy_id are required' });
    }
    
    await ProxyAssignmentService.forceAssignProxy(user_id, proxy_id, reason || 'admin_manual');
    
    res.json({
      success: true,
      message: 'Proxy force assigned successfully'
    });
    
  } catch (error) {
    console.error('Error force assigning proxy:', error);
    res.status(500).json({ 
      error: 'Failed to force assign proxy', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}; 