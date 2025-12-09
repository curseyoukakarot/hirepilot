import * as sourcingModule from '../services/sourcing';
import { sourcingRunPersonaTool } from '../mcp/sourcing.run_persona';

const emailQueueAdd = jest.fn();
const sequenceMaybeSingle = jest.fn();
const leadsIn = jest.fn();

jest.mock('../queues/redis', () => ({
  emailQueue: {
    add: emailQueueAdd
  }
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'sourcing_sequences') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: sequenceMaybeSingle
            })
          })
        };
      }
      if (table === 'sourcing_leads') {
        return {
          select: () => ({
            in: leadsIn
          })
        };
      }
      return { select: () => ({}) };
    }
  }
}));

const personaSingle = jest.fn();

jest.mock('../lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'personas') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: personaSingle
              })
            })
          })
        };
      }
      if (table === 'sourcing_campaigns') {
        return {
          insert: () => ({
            select: () => ({
              single: jest.fn().mockResolvedValue({ data: { id: 'camp-new' } })
            })
          })
        };
      }
      return { select: () => ({}) };
    }
  }
}));

jest.mock('../services/sendgrid', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../utils/apolloApi', () => ({
  searchAndEnrichPeople: jest.fn().mockResolvedValue({
    leads: [
      { firstName: 'Alex', lastName: 'Gray', title: 'AE', company: 'Acme', email: 'alex@example.com' }
    ]
  })
}));

describe('sendSequenceForLeads helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequenceMaybeSingle.mockResolvedValue({
      data: {
        steps_json: {
          step1: { subject: 'Hi', body: 'Hello {{name}}' },
          step2: { subject: 'Follow up', body: 'Checking in {{name}}' },
          spacingBusinessDays: 2
        }
      }
    });
    leadsIn.mockResolvedValue({
      data: [
        { id: 'lead-1', email: 'one@example.com', name: 'One' },
        { id: 'lead-2', email: 'two@example.com', name: 'Two' }
      ]
    });
  });

  it('queues no more than the daily cap', async () => {
    const result = await sourcingModule.sendSequenceForLeads({
      campaignId: 'camp-123',
      leadIds: ['lead-1', 'lead-2'],
      sendDelayMinutes: 45,
      dailySendCap: 1
    });
    expect(result.scheduled).toBe(1);
    expect(result.skipped).toBe(1);
    expect(emailQueueAdd).toHaveBeenCalled();
  });
});

describe('sourcingRunPersonaTool auto outreach', () => {
  const addLeadsSpy = jest.spyOn(sourcingModule, 'addLeads');
  const autoSendSpy = jest.spyOn(sourcingModule, 'sendSequenceForLeads');

  beforeEach(() => {
    jest.clearAllMocks();
    personaSingle.mockResolvedValue({
      data: {
        id: 'persona-1',
        user_id: 'user-1',
        name: 'AE Persona',
        titles: ['AE'],
        include_keywords: [],
        exclude_keywords: [],
        locations: [],
        channels: [],
        goal_total_leads: 100
      }
    });
    addLeadsSpy.mockResolvedValue({
      inserted: 1,
      leads: [{ id: 'lead-xyz', email: 'alex@example.com' }]
    } as any);
    autoSendSpy.mockResolvedValue({ scheduled: 1, skipped: 0 } as any);
  });

  afterAll(() => {
    addLeadsSpy.mockRestore();
    autoSendSpy.mockRestore();
  });

  it('invokes auto-outreach helper with schedule metadata', async () => {
    await sourcingRunPersonaTool.handler({
      userId: 'user-1',
      persona_id: 'persona-1',
      linked_campaign_id: 'camp-456',
      auto_outreach_enabled: true,
      leads_per_run: 25,
      send_delay_minutes: 30,
      daily_send_cap: 5,
      schedule_id: 'sched-999'
    });

    expect(addLeadsSpy).toHaveBeenCalled();
    const addLeadsArgs = addLeadsSpy.mock.calls[0][2];
    expect(addLeadsArgs?.mirrorMetadata?.lead_source).toBe('schedule:sched-999');
    expect(addLeadsArgs?.mirrorMetadata?.tags).toContain('auto:schedule:sched-999');
    expect(autoSendSpy).toHaveBeenCalledWith({
      campaignId: 'camp-456',
      leadIds: ['lead-xyz'],
      sendDelayMinutes: 30,
      dailySendCap: 5
    });
  });
});


