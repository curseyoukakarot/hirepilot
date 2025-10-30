import path from 'path';

// Mock SendGrid integration to capture payload
const sendMock = jest.fn(async () => ({}));
jest.mock('../integrations/sendgrid', () => ({
  sendEmail: (args: any) => sendMock(args)
}));

// Provide a mock supabase client for suppression tests
const maybeSingleMock = jest.fn();
const orderMock = jest.fn(() => ({ limit: () => ({ maybeSingle: maybeSingleMock }) }));
const selectMock = jest.fn(() => ({ eq: () => ({ order: orderMock }) }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: selectMock })
  }
}));

import { sendLifecycleEmail } from '../lib/sendLifecycleEmail';
import { canSendLifecycleEmail } from '../lib/emailSuppressor';
import { LifecycleEventKey } from '../lib/emailEvents';
import { templateMap } from '../workers/featureTriggers';

const APP_URL = process.env.APP_URL || 'https://thehirepilot.com';
const BLOG_URL = process.env.BLOG_URL || 'https://thehirepilot.com/blog';

describe('sendLifecycleEmail', () => {
  beforeEach(() => sendMock.mockClear());

  it('loads template and injects tokens', async () => {
    const to = 'test@example.com';
    await sendLifecycleEmail({
      to,
      template: 'feature-deals',
      tokens: {
        first_name: 'Ava',
        cta_url: `${APP_URL}/deals`,
        article_url: `${BLOG_URL}/deals-guide`,
        app_url: APP_URL,
      }
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe(to);
    expect(arg.from).toMatch(/notifications@hirepilot\.com/);
    expect(arg.subject).toBeTruthy();
    expect(arg.html).toContain('Ava');
    expect(arg.html).toContain(`${APP_URL}/deals`);
    expect(arg.html).not.toContain('{{first_name}}');
  });
});

describe('canSendLifecycleEmail', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
  });

  it('allows when no prior email', async () => {
    maybeSingleMock.mockResolvedValueOnce(null);
    await expect(canSendLifecycleEmail('user-1')).resolves.toBe(true);
  });

  it('suppresses when prior email is recent (<4h)', async () => {
    const now = new Date();
    maybeSingleMock.mockResolvedValueOnce({ created_at: now.toISOString() });
    await expect(canSendLifecycleEmail('user-2')).resolves.toBe(false);
  });
});

describe('templateMap', () => {
  it('maps all LifecycleEventKey to templates 1:1', () => {
    expect(templateMap[LifecycleEventKey.Deals]).toBe('feature-deals');
    expect(templateMap[LifecycleEventKey.REX]).toBe('feature-rex-agent');
    expect(templateMap[LifecycleEventKey.Workflows]).toBe('feature-workflows');
    expect(templateMap[LifecycleEventKey.CampaignWizard]).toBe('feature-campaign-wizard');
    expect(templateMap[LifecycleEventKey.Integrations]).toBe('feature-integrations');
    expect(templateMap[LifecycleEventKey.Founder]).toBe('founder-intro');
  });
});


