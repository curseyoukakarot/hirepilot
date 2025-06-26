import 'dotenv/config';
import path from 'path';
import { supabase } from '../lib/supabase';
import { launchQueue } from '../../api/campaigns/launch';
import sgMail from '@sendgrid/mail';
import { enrichLead as proxycurlEnrichLead } from '../../services/proxycurl/enrichLead';

// Resolve SDK root then require specific compiled files to sidestep export mapping quirks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sdkRoot = path.dirname(require.resolve('@modelcontextprotocol/sdk/package.json'));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Server } = require(path.join(sdkRoot, 'server/index.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StdioServerTransport } = require(path.join(sdkRoot, 'server/stdio.js'));

// ---------------------------------------------------------------------------------
// Minimal REX MCP server (stdio transport)
// ---------------------------------------------------------------------------------
const server = new Server({ name: 'REX Server', version: '0.1.0' });

// ------------------ Tool capabilities ------------------
server.registerCapabilities({
  tools: {
    add_numbers: {
      parameters: { a: { type: 'number' }, b: { type: 'number' } },
      handler: async ({ a, b }: { a: number; b: number }) => a + b
    },
    schedule_campaign: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'}, send_time:{type:'string'} },
      handler: async ({ userId, campaign_id, send_time }) => {
        await assertPremium(userId);
        if (!launchQueue) throw new Error('Launch queue not configured');
        const job = await launchQueue.add('launch',{ campaignId:campaign_id, scheduleAt:send_time, userId });
        return { queued:true, jobId:job.id };
      }
    },
    send_email: {
      parameters: { userId:{type:'string'}, to:{type:'string'}, subject:{type:'string'}, body:{type:'string'} },
      handler: async ({ userId, to, subject, body }) => {
        await assertPremium(userId);
        const { data } = await supabase.from('user_sendgrid_keys').select('api_key, default_sender').eq('user_id', userId).single();
        if (!data?.api_key || !data?.default_sender) throw new Error('No SendGrid config');
        sgMail.setApiKey(data.api_key);
        const [resp] = await sgMail.send({ to, from:data.default_sender, subject, html:body });
        return { messageId: resp.headers['x-message-id'] };
      }
    },
    enrich_lead: {
      parameters: { userId:{type:'string'}, linkedin_identifier:{type:'string'} },
      handler: async ({ userId, linkedin_identifier }) => {
        await assertPremium(userId);

        let url = linkedin_identifier;

        // If the identifier doesn't look like a linkedin.com URL, treat as lead ID
        if (!/linkedin\.com\/in\//i.test(linkedin_identifier)) {
          const { data, error } = await supabase
            .from('leads')
            .select('linkedin_url')
            .eq('id', linkedin_identifier)
            .single();
          if (error) throw error;
          if (!data?.linkedin_url) throw new Error('Lead does not have a LinkedIn URL');
          url = data.linkedin_url as string;
        }

        return await proxycurlEnrichLead(url);
      }
    },
    get_campaign_metrics: {
      parameters: { userId:{type:'string'}, campaign_id:{type:'string'} },
      handler: async ({ userId, campaign_id }) => {
        await assertPremium(userId);
        // Prefer materialized table if exists; fall back to debug view
        let { data, error } = await supabase
          .from('campaign_metrics')
          .select('*')
          .eq('campaign_id', campaign_id)
          .maybeSingle();

        if (error && error.code === '42P01') {
          // relation does not exist – use view instead
          ({ data, error } = await supabase
            .from('vw_campaign_metrics_debug')
            .select('*')
            .eq('campaign_id', campaign_id)
            .maybeSingle());
        }

        if (error) throw error;
        return data;
      }
    }
  }
});

// Attach stdio transport (must be after capabilities registration)
server.connect(new StdioServerTransport());

console.log('✅ REX MCP server running on stdio');

async function assertPremium(userId: string) {
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
  if (error) throw error;
  const role = data?.role ?? '';
  if (!['RecruitPro','TeamAdmin','SuperAdmin','super_admin'].includes(role)) {
    throw new Error('REX access restricted to premium plans.');
  }
}

export { server }; 