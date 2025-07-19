import { Router } from 'express';
import { handleLinkedInRequest, approveLinkedInRequest } from '../api/rex/linkedinRequest';
import { 
  updateAutomationConsent, 
  toggleAutoMode, 
  getRexSettings, 
  getRexActivityLog 
} from '../api/rex/consentManagement';

const router = Router();

/**
 * REX Integration API Routes (Prompt 6)
 * 
 * These routes handle the Auto/Manual toggle logic for LinkedIn automation
 */

// Main LinkedIn request modal logic
router.post('/linkedin-request', handleLinkedInRequest);

// Manual approval after review
router.post('/approve-request', approveLinkedInRequest);

// Consent management
router.post('/consent', updateAutomationConsent);

// Auto mode toggle
router.post('/auto-mode', toggleAutoMode);

// Get user REX settings
router.get('/settings', getRexSettings);

// Get activity log
router.get('/activity-log', getRexActivityLog);

export default router; 