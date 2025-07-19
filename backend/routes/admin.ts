import { Router } from 'express';
import { 
  getDashboardStats,
  getJobTable, 
  getJobDetails,
  getUserPerformance,
  getSystemStatus,
  getAdminLog,
  getProxyStatus,
  adminMiddleware
} from '../api/admin/puppetMonitor';
import {
  executeJobAction,
  executeUserAction,
  executeBulkAction,
  executeEmergencyAction
} from '../api/admin/puppetControls';

const router = Router();

/**
 * Super Admin Dashboard Routes (Prompt 7)
 * 
 * These routes provide comprehensive monitoring and control
 * for the Puppet LinkedIn automation system
 * 
 * REQUIRES: super_admin role
 */

// Apply super admin middleware to all routes
router.use(adminMiddleware);

// Dashboard Statistics
router.get('/puppet/stats', getDashboardStats);

// Job Management
router.get('/puppet/jobs', getJobTable);
router.get('/puppet/jobs/:jobId', getJobDetails);
router.post('/puppet/jobs/action', executeJobAction);

// User Management  
router.get('/puppet/users', getUserPerformance);
router.post('/puppet/users/action', executeUserAction);

// Bulk Operations
router.post('/puppet/bulk', executeBulkAction);

// Emergency Controls
router.get('/puppet/system/status', getSystemStatus);
router.post('/puppet/emergency', executeEmergencyAction);

// Proxy Monitoring
router.get('/puppet/proxies', getProxyStatus);

// Admin Activity Log
router.get('/puppet/admin-log', getAdminLog);

export default router; 