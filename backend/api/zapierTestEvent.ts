// backend/api/zapierTestEvent.ts
// Test endpoint for users to verify their webhook integrations

import { Router, Response } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { ApiRequest } from '../types/api';
import { emitZapEvent, ZAP_EVENT_TYPES, ZapEventType } from '../lib/zapEventEmitter';

const router = Router();

// Sample event data for testing
const SAMPLE_EVENT_DATA: Record<string, any> = {
  [ZAP_EVENT_TYPES.LEAD_CREATED]: {
    id: 'test-lead-123',
    email: 'test@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    full_name: 'Jane Doe',
    company: 'Acme Corp',
    title: 'Software Engineer',
    status: 'new',
    linkedin_url: 'https://linkedin.com/in/janedoe',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  [ZAP_EVENT_TYPES.CANDIDATE_HIRED]: {
    id: 'test-candidate-456',
    first_name: 'John',
    last_name: 'Smith',
    full_name: 'John Smith',
    email: 'john@example.com',
    phone: '+1 (555) 123-4567',
    status: 'hired',
    previous_status: 'offered',
    hired_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  [ZAP_EVENT_TYPES.MESSAGE_SENT]: {
    id: 'test-message-789',
    lead_id: 'test-lead-123',
    campaign_id: 'test-campaign-101',
    provider: 'sendgrid',
    subject: 'Exciting Opportunity at Acme Corp',
    content: 'Hi Jane, I hope this message finds you well...',
    status: 'sent',
    created_at: new Date().toISOString()
  },
  [ZAP_EVENT_TYPES.CANDIDATE_MOVED_TO_STAGE]: {
    candidate_id: 'test-candidate-456',
    job_id: 'test-job-202',
    stage_title: 'Final Interview',
    old_stage_title: 'Phone Screen',
    candidate_name: 'John Smith',
    candidate_email: 'john@example.com',
    moved_at: new Date().toISOString()
  },
  [ZAP_EVENT_TYPES.EMAIL_OPENED]: {
    id: 'test-email-event-111',
    lead_id: 'test-lead-123',
    campaign_id: 'test-campaign-101',
    message_id: 'test-message-789',
    provider: 'sendgrid',
    event_timestamp: new Date().toISOString(),
    metadata: {
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ip_address: '192.168.1.1'
    }
  },
  [ZAP_EVENT_TYPES.CAMPAIGN_CREATED]: {
    id: 'test-campaign-101',
    title: 'Senior Software Engineer Hiring',
    name: 'Senior Software Engineer Hiring',
    description: 'Looking for experienced software engineers to join our team',
    status: 'draft',
    job_id: 'test-job-202',
    lead_source_type: 'apollo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
};

/**
 * POST /api/zapier/test-event
 * Emit a test event to verify webhook integrations
 * Body: { event_type: string }
 */
router.post('/test-event', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { event_type } = req.body;

    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }

    // Validate event type
    const validEventTypes = Object.values(ZAP_EVENT_TYPES);
    if (!validEventTypes.includes(event_type as ZapEventType)) {
      return res.status(400).json({ 
        error: 'Invalid event_type',
        valid_types: validEventTypes
      });
    }

    // Get sample data for the event type
    const sampleData = SAMPLE_EVENT_DATA[event_type] || {
      message: `Test event for ${event_type}`,
      timestamp: new Date().toISOString()
    };

    // Add test metadata to indicate this is a test event
    const testEventData = {
      ...sampleData,
      _test: true,
      _test_timestamp: new Date().toISOString(),
      _test_user_id: userId
    };

    // Emit the test event
    await emitZapEvent({
      userId,
      eventType: event_type as ZapEventType,
      eventData: testEventData,
      sourceTable: 'test',
      sourceId: `test-${Date.now()}`
    });

    return res.status(200).json({
      success: true,
      message: `Test event '${event_type}' has been emitted`,
      event_data: testEventData,
      note: 'This test event has been sent to all your registered webhooks for this event type'
    });

  } catch (err: any) {
    console.error('[Zapier] /test-event error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/zapier/event-types
 * List all available event types for reference
 */
router.get('/event-types', apiKeyAuth, async (req: ApiRequest, res: Response) => {
  try {
    const eventTypes = Object.entries(ZAP_EVENT_TYPES).map(([key, value]) => ({
      key,
      value,
      sample_data: SAMPLE_EVENT_DATA[value] ? Object.keys(SAMPLE_EVENT_DATA[value]) : []
    }));

    return res.status(200).json({
      event_types: eventTypes,
      total_count: eventTypes.length
    });

  } catch (err: any) {
    console.error('[Zapier] /event-types error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router; 