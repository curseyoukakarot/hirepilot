/**
 * API: Proxy Health Monitoring
 * Handles proxy health monitoring and auto-rotation operations
 */

import { Request, Response } from 'express';
import { ProxyHealthMonitoringService } from '../../services/puppet/proxyHealthMonitoringService';

/**
 * Check if proxy is healthy for job execution
 * GET /api/puppet/proxy/health/check/:proxyId
 */
export const checkProxyHealth = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { proxyId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!proxyId) {
      return res.status(400).json({ error: 'Proxy ID is required' });
    }
    
    const healthCheck = await ProxyHealthMonitoringService.isProxyHealthyForJob(proxyId, userId);
    
    res.json({
      success: true,
      data: healthCheck
    });
    
  } catch (error) {
    console.error('Error checking proxy health:', error);
    res.status(500).json({ 
      error: 'Failed to check proxy health', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get detailed proxy health metrics
 * GET /api/puppet/proxy/health/metrics/:proxyId
 */
export const getProxyHealthMetrics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { proxyId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!proxyId) {
      return res.status(400).json({ error: 'Proxy ID is required' });
    }
    
    const health = await ProxyHealthMonitoringService.getProxyHealth(proxyId, userId);
    
    if (!health) {
      return res.status(404).json({ error: 'No health record found for this proxy' });
    }
    
    const metrics = ProxyHealthMonitoringService.calculateHealthMetrics(health);
    
    res.json({
      success: true,
      data: {
        health_record: health,
        metrics: metrics
      }
    });
    
  } catch (error) {
    console.error('Error getting proxy health metrics:', error);
    res.status(500).json({ 
      error: 'Failed to get proxy health metrics', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Record job outcome for health tracking
 * POST /api/puppet/proxy/health/record-outcome
 */
export const recordJobOutcome = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { 
      proxy_id, 
      was_successful, 
      failure_type, 
      error_message, 
      response_time_ms 
    } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!proxy_id || typeof was_successful !== 'boolean') {
      return res.status(400).json({ 
        error: 'proxy_id and was_successful are required' 
      });
    }
    
    const context = was_successful ? undefined : {
      failure_type: failure_type || 'other',
      error_message,
      response_time_ms
    };
    
    await ProxyHealthMonitoringService.recordJobOutcome(
      proxy_id,
      userId,
      was_successful,
      context
    );
    
    res.json({
      success: true,
      message: 'Job outcome recorded successfully'
    });
    
  } catch (error) {
    console.error('Error recording job outcome:', error);
    res.status(500).json({ 
      error: 'Failed to record job outcome', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Manually evaluate proxy health
 * POST /api/puppet/proxy/health/evaluate/:proxyId
 */
export const evaluateProxyHealth = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { proxyId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!proxyId) {
      return res.status(400).json({ error: 'Proxy ID is required' });
    }
    
    await ProxyHealthMonitoringService.evaluateProxyHealth(proxyId, userId);
    
    // Get updated health status
    const updatedHealth = await ProxyHealthMonitoringService.getProxyHealth(proxyId, userId);
    
    res.json({
      success: true,
      message: 'Proxy health evaluated successfully',
      data: updatedHealth
    });
    
  } catch (error) {
    console.error('Error evaluating proxy health:', error);
    res.status(500).json({ 
      error: 'Failed to evaluate proxy health', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Admin: Get proxy health overview
 * GET /api/puppet/proxy/health/admin/overview
 */
export const getProxyHealthOverview = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const overview = await ProxyHealthMonitoringService.getProxyHealthOverview();
    
    res.json({
      success: true,
      data: overview
    });
    
  } catch (error) {
    console.error('Error getting proxy health overview:', error);
    res.status(500).json({ 
      error: 'Failed to get proxy health overview', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Admin: Get failing proxies
 * GET /api/puppet/proxy/health/admin/failing
 */
export const getFailingProxies = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const failingProxies = await ProxyHealthMonitoringService.getFailingProxies();
    
    res.json({
      success: true,
      data: failingProxies
    });
    
  } catch (error) {
    console.error('Error getting failing proxies:', error);
    res.status(500).json({ 
      error: 'Failed to get failing proxies', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Admin: Manually re-enable proxy
 * POST /api/puppet/proxy/health/admin/re-enable
 */
export const reEnableProxy = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { proxy_id, user_id } = req.body;
    
    if (!proxy_id || !user_id) {
      return res.status(400).json({ 
        error: 'proxy_id and user_id are required' 
      });
    }
    
    await ProxyHealthMonitoringService.reEnableProxy(proxy_id, user_id);
    
    res.json({
      success: true,
      message: 'Proxy re-enabled successfully'
    });
    
  } catch (error) {
    console.error('Error re-enabling proxy:', error);
    res.status(500).json({ 
      error: 'Failed to re-enable proxy', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Admin: Send test Slack notification
 * POST /api/puppet/proxy/health/admin/test-notification
 */
export const sendTestNotification = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { message, urgent } = req.body;
    
    await ProxyHealthMonitoringService.sendSlackNotification(
      message || 'Test notification from Proxy Health Monitor',
      urgent || false
    );
    
    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });
    
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ 
      error: 'Failed to send test notification', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get user's proxy health status
 * GET /api/puppet/proxy/health/my-status
 */
export const getMyProxyHealthStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get user's current proxy assignment
    const { ProxyAssignmentService } = await import('../../services/puppet/proxyAssignmentService');
    const assignment = await ProxyAssignmentService.getUserProxyAssignment(userId);
    
    if (!assignment) {
      return res.json({
        success: true,
        data: {
          has_assignment: false,
          message: 'No proxy assigned'
        }
      });
    }
    
    // Get health status for the assigned proxy
    const health = await ProxyHealthMonitoringService.getProxyHealth(assignment.proxy_id, userId);
    const healthCheck = await ProxyHealthMonitoringService.isProxyHealthyForJob(assignment.proxy_id, userId);
    
    let metrics = null;
    if (health) {
      metrics = ProxyHealthMonitoringService.calculateHealthMetrics(health);
    }
    
    res.json({
      success: true,
      data: {
        has_assignment: true,
        assignment,
        health,
        health_check: healthCheck,
        metrics
      }
    });
    
  } catch (error) {
    console.error('Error getting user proxy health status:', error);
    res.status(500).json({ 
      error: 'Failed to get proxy health status', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}; 