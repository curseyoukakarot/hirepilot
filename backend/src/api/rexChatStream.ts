import { Request, Response } from 'express';
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';
import fetch from 'node-fetch';
import { completeOnboardingStep } from '../lib/onboarding';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseEvent(res: Response, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sseTokens(res: Response, text: string) {
  // Send full text as a single token event (for pre-processor short-circuits)
  sseEvent(res, 'token', { t: text });
}

async function withTimeout<T>(p: Promise<T>, ms = 25000): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ] as [Promise<T>, Promise<T>]);
}

async function persistMessage(
  baseUrl: string,
  convId: string,
  role: string,
  content: any,
  authHeader: string
) {
  try {
    await fetch(`${baseUrl}/api/rex/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify({ role, content })
    });
  } catch (e) {
    console.error('[rexChatStream] persist error', e);
  }
}

async function ensureConversation(
  baseUrl: string,
  convId: string | undefined,
  title: string,
  authHeader: string
): Promise<string | undefined> {
  if (convId) return convId;
  try {
    const resp = await fetch(`${baseUrl}/api/rex/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify({ title: title.slice(0, 120) })
    });
    const data = await resp.json();
    return (data as any)?.conversation?.id;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Pre-processors: return { handled, reply } if short-circuited
// ---------------------------------------------------------------------------

async function runPreProcessors(
  messages: any[],
  userId: string
): Promise<{ handled: boolean; reply?: string }> {
  const lastUserMsg = [...(messages || [])].reverse().find((m: any) => m.role === 'user');
  const lastUserText = String((lastUserMsg as any)?.content || '').toLowerCase();
  const lastUserRaw = String((lastUserMsg as any)?.content || '');

  // Slack setup
  if (/(setup|set\s*up|enable).*(rex).*slack|slack.*(setup|set\s*up).*rex/.test(lastUserText)) {
    const base = process.env.BACKEND_URL || process.env.BACKEND_PUBLIC_URL || 'https://api.thehirepilot.com';
    const urls = {
      commands: `${base}/api/slack/commands`,
      interactivity: `${base}/api/slack/interactivity`,
      events: `${base}/api/slack/events`
    };
    return {
      handled: true,
      reply: [
        'Here\'s how to enable REX in your Slack workspace:',
        `1) Go to https://api.slack.com/apps → Create New App → From scratch → Name: "HirePilot (REX)" and choose your workspace.`,
        `2) Slash Commands → Create new → Command: /rex → Request URL: ${urls.commands} → Usage hint: /rex link me → Save.`,
        `3) Interactivity & Shortcuts → Toggle ON → Request URL: ${urls.interactivity} → Save.`,
        `4) (Optional) Event Subscriptions → Toggle ON → Request URL: ${urls.events} → Add bot event: app_mention → Save.`,
        '5) OAuth & Permissions → Bot Token Scopes → add: commands, chat:write, channels:read, users:read → Install to workspace.',
        '6) In Slack, invite the bot to a channel with /invite @YourBot → then run /rex link me and /rex hello.'
      ].join('\n')
    };
  }

  // Provider preference
  const providerMatch = /(send\s+from\s+my\s+)(sendgrid|google|outlook)(\s+account)?/i.exec(lastUserRaw);
  if (providerMatch) {
    const providerHint = providerMatch[2].toLowerCase();
    try {
      await supabase
        .from('user_settings')
        .upsert({ user_id: userId, preferred_email_provider: providerHint }, { onConflict: 'user_id' });
    } catch {}
  }

  // Send to lead by UUID
  const sendLeadMatch = /(send|email)[^\n]*?(?:to|lead)[^\n]*?(?:lead[-_\s]*id[:\s]*)?([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i.exec(lastUserRaw);
  if (sendLeadMatch) {
    const leadId = sendLeadMatch[2];
    const prevAssistant = [...(messages || [])].slice(0, Math.max(0, (messages || []).length - 1)).reverse().find((m: any) => m.role === 'assistant');
    const assistantText = prevAssistant
      ? (typeof (prevAssistant as any).content === 'string' ? String((prevAssistant as any).content) : String((prevAssistant as any)?.content?.text || ''))
      : '';

    let subject = '';
    const subjMatch = /\*\*?subject\*\*?\s*:?\s*(.+)/i.exec(assistantText) || /subject\s*:?\s*(.+)/i.exec(assistantText);
    if (subjMatch) subject = subjMatch[1].trim();
    if (!subject) subject = 'Message';
    const html = assistantText ? assistantText.replace(/\n/g, '<br/>') : '';

    if (html) {
      try {
        const { server: rexServer } = await import('../rex/server');
        const caps = rexServer.getCapabilities?.();
        const tool = caps?.tools?.['send_email_to_lead'];
        if (tool?.handler) {
          const result = await tool.handler({ userId, lead_id: leadId, subject, html });
          if (result?.ok) {
            const used = result?.used || 'provider';
            return { handled: true, reply: `Email sent to lead ${leadId} via ${used}.` };
          }
          if (result?.error === 'NO_EMAIL_PROVIDER') {
            return { handled: true, reply: 'You need to connect an email service first (SendGrid, Google, or Outlook). Go to Settings → Integrations to connect.' };
          }
        }
      } catch {}
    }
  }

  // Sniper LinkedIn post collection
  const urlEarly = /https?:\/\/[^\s]*linkedin\.com\/posts\/[^\s]+/i.exec(lastUserRaw)?.[0];
  const wantsLikersEarly = /like|liked|likers/.test(lastUserText);
  if (urlEarly && wantsLikersEarly) {
    try {
      const { server: rexServer } = await import('../rex/server');
      const caps = rexServer.getCapabilities?.();
      const sniper = caps?.tools?.['sniper_collect_post'];
      if (sniper?.handler) {
        const queued: any = await sniper.handler({ userId, post_url: urlEarly, limit: 0 });
        const summary = queued?.error
          ? `Sniper queue failed: ${queued.error}`
          : `Sniper queued capture for this post. target_id=${queued?.target_id || ''} job_id=${queued?.job_id || ''} (ETA ~${queued?.eta_seconds || 60}s). Say: "poll sniper ${queued?.target_id}" to fetch results.`;
        return { handled: true, reply: summary };
      }
    } catch {}
  }

  // Campaign LinkedIn outreach
  const wantsLinkedInOutreach = /(send|queue).*(linkedin).*(outreach|connect|connection)/i.test(lastUserText);
  const wantsCampaign = /campaign/i.test(lastUserText);
  const tplMatch = /template[^"'`]*["'`]\s*([^"'`]+?)\s*["'`]/i.exec(lastUserRaw);
  if (wantsLinkedInOutreach && wantsCampaign && tplMatch?.[1]) {
    try {
      const templateName = String(tplMatch[1]).trim();
      const { server: rexServer } = await import('../rex/server');
      const caps = rexServer.getCapabilities?.();
      const tool = caps?.tools?.['sniper_campaign_outreach_connect'];
      if (tool?.handler) {
        const result: any = await withTimeout(tool.handler({ userId, campaign_id: 'latest', template_name: templateName }), 45000);
        const summary = result?.error_code === 'CLOUD_ENGINE_DISABLED' && result?.help
          ? String(result.help)
          : result?.error
            ? `LinkedIn outreach failed: ${result.error}`
            : `Queued LinkedIn connect requests for campaign (template: "${templateName}"). job_id=${result?.job_id || ''} requested=${result?.requested || 0}. Track in /sniper/activity.`;
        return { handled: true, reply: summary };
      }
    } catch {}
  }

  return { handled: false };
}

// ---------------------------------------------------------------------------
// Post-processing: apply deterministic overrides
// ---------------------------------------------------------------------------

function applyPostProcessors(
  content: string,
  lastToolResult: any,
  executedSourcing: boolean,
  messages: any[]
): string {
  let result = content;

  // Error overrides — safety-critical, fully replace model output
  if (lastToolResult && lastToolResult.error === 'NO_EMAIL_PROVIDER') {
    return 'You need to connect an email service first (SendGrid, Google, or Outlook). Go to **Settings → Integrations** to connect.';
  }
  if (lastToolResult && lastToolResult.error_code === 'CLOUD_ENGINE_DISABLED' && lastToolResult.help) {
    return String(lastToolResult.help);
  }

  // Campaign view links — append (don't replace)
  if (lastToolResult && (lastToolResult.campaign_id || lastToolResult.std_campaign_id)) {
    result += `\n\n[View in Agent Mode](/agent-mode?campaign=${lastToolResult.campaign_id || ''}) · [View in Leads](/leads?campaign=${lastToolResult.std_campaign_id || ''})`;
  }

  // Outreach nudge — append (don't replace)
  if (executedSourcing && ((lastToolResult?.imported || 0) > 0)) {
    const lastUser = messages[messages.length - 1];
    const text = String(lastUser?.content || '').toLowerCase();
    const wantsOutreach = /(reach out|email|send|outreach|contact)/.test(text);
    if (!wantsOutreach) {
      result += '\n\nWant me to start outreach to these leads? Just tell me the tone (casual, professional, etc.) and I\'ll draft the opener.';
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tool definitions (same as rexChat.ts)
// ---------------------------------------------------------------------------

function getToolDefinitions(): any[] {
  return [
    { type:'function',function:{name:'schedule_campaign',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},send_time:{type:'string'}},required:['userId','campaign_id','send_time']}}},
    { type:'function',function:{name:'send_email',parameters:{type:'object',properties:{userId:{type:'string'},to:{type:'string'},subject:{type:'string'},body:{type:'string'},provider:{type:'string'},template_name:{type:'string'},template_id:{type:'string'}},required:['userId','to']}}},
    { type:'function',function:{name:'list_email_templates',parameters:{type:'object',properties:{userId:{type:'string'},query:{type:'string'}},required:['userId']}}},
    { type:'function',function:{name:'send_template_email',parameters:{type:'object',properties:{userId:{type:'string'},lead:{type:'string'},template_name:{type:'string'},template_id:{type:'string'},provider:{type:'string'}},required:['userId','lead']}}},
    { type:'function',function:{name:'enrich_lead',parameters:{type:'object',properties:{userId:{type:'string'},linkedin_url:{type:'string'}},required:['userId','linkedin_url']}}},
    { type:'function',function:{name:'get_campaign_metrics',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'slack_setup_guide',parameters:{type:'object',properties:{userId:{type:'string'}},required:['userId']}}},
    { type:'function',function:{name:'source_leads',parameters:{type:'object',properties:{userId:{type:'string'},campaignId:{type:'string'},source:{type:'string',description:'Lead source: "apollo" (default, fast) or "linkedin"'},filters:{type:'object',description:'Search criteria for finding leads',properties:{title:{type:'string',description:'Job title to search for (e.g. "CISO", "VP Engineering", "Head of Sales")'},location:{type:'string',description:'Location to search in (e.g. "San Francisco", "New York, NY", "London, UK")'},keywords:{type:'string',description:'Additional keywords for broader search'},count:{type:'number',description:'Number of leads to return (default 25, max 200)'},booleanSearch:{type:'boolean',description:'Use Boolean syntax in title field'}},required:['title','location']}},required:['userId','campaignId','source']}}},
    { type:'function',function:{name:'filter_leads',parameters:{type:'object',properties:{userId:{type:'string'},campaignId:{type:'string'},filters:{type:'object',properties:{title:{type:'string'},synonyms:{type:'boolean'},strict_level:{type:'boolean'},has_email:{type:'boolean'},verified_only:{type:'boolean'},personal_email_only:{type:'boolean'},limit:{type:'number'},count:{type:'number'}}}},required:['userId']}}},
    { type:'function',function:{name:'convert_lead_to_candidate',parameters:{type:'object',properties:{userId:{type:'string'},leadId:{type:'string'}},required:['userId','leadId']}}},
    { type:'function',function:{name:'view_pipeline',parameters:{type:'object',properties:{userId:{type:'string'},jobId:{type:'string'},stage:{type:'string'},staleDays:{type:'number'},candidateName:{type:'string'}},required:['userId','jobId']}}},
    { type:'function',function:{name:'move_candidate_to_stage',parameters:{type:'object',properties:{userId:{type:'string'},candidate:{type:'string'},stage:{type:'string'},jobId:{type:'string'}},required:['userId','candidate','stage']}}},
    { type:'function',function:{name:'move_candidate',parameters:{type:'object',properties:{userId:{type:'string'},candidateId:{type:'string'},newStage:{type:'string'}},required:['userId','candidateId','newStage']}}},
    { type:'function',function:{name:'update_candidate_notes',parameters:{type:'object',properties:{userId:{type:'string'},candidateId:{type:'string'},note:{type:'string'},author:{type:'string'}},required:['userId','candidateId','note','author']}}},
    { type:'function',function:{name:'send_campaign_email_auto',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},template_name:{type:'string',optional:true},subject:{type:'string',optional:true},html:{type:'string',optional:true},scheduled_for:{type:'string',optional:true},channel:{type:'string',optional:true}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'set_preferred_email_provider',parameters:{type:'object',properties:{userId:{type:'string'},provider:{type:'string',enum:['sendgrid','google','outlook']}},required:['userId','provider']}}},
    { type:'function',function:{name:'send_email_to_lead',parameters:{type:'object',properties:{userId:{type:'string'},lead_id:{type:'string'},subject:{type:'string',optional:true},html:{type:'string',optional:true},provider:{type:'string',optional:true}},required:['userId','lead_id']}}},
    { type:'function',function:{name:'enroll_campaign_in_sequence_by_name',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},sequence_name:{type:'string'},start_time_local:{type:'string'},timezone:{type:'string'},provider:{type:'string'}},required:['userId','campaign_id','sequence_name']}}},
    { type:'function',function:{name:'create_sequence_from_template_and_enroll',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},template_name:{type:'string'},delays_business_days:{type:'array',items:{type:'number'}},timezone:{type:'string'},start_time_local:{type:'string'},provider:{type:'string'}},required:['userId','campaign_id','template_name','delays_business_days']}}},
    { type:'function',function:{name:'resume_intelligence',parameters:{type:'object',properties:{mode:{type:'string',enum:['analyze','rewrite','coach','builder_generate']},resume_text:{type:'string'},linkedin_text:{type:'string'},target_role:{type:'string'},target_title:{type:'string'},user_context:{type:'string'}},required:['mode','resume_text']}}},
    { type:'function',function:{name:'resume_scoring',parameters:{type:'object',properties:{resume_text:{type:'string'},target_role:{type:'string'}},required:['resume_text']}}},
    { type:'function',function:{name:'linkedin_intelligence',parameters:{type:'object',properties:{mode:{type:'string',enum:['analyze','rewrite']},linkedin_text:{type:'string'},resume_text:{type:'string'},target_role:{type:'string'}},required:['mode','linkedin_text']}}},
    { type:'function',function:{name:'resume_to_outreach',parameters:{type:'object',properties:{resume_json:{type:'object'},target_role:{type:'string'},company_context:{type:'string'}},required:['resume_json']}}},
    { type:'function',function:{name:'create_persona_auto_track',parameters:{type:'object',properties:{userId:{type:'string'},persona_id:{type:'string'},campaign_mode:{type:'string',enum:['use_existing','create_new']},existing_campaign_id:{type:'string',nullable:true},new_campaign_name:{type:'string',nullable:true},cadence:{type:'string'},day_of_week:{type:'string',nullable:true},time_utc:{type:'string'},leads_per_run:{type:'number'},send_delay_minutes:{type:'number'},daily_send_cap:{type:'number',nullable:true}},required:['userId','persona_id','campaign_mode','cadence','time_utc','leads_per_run','send_delay_minutes']}}},
    { type:'function',function:{name:'sourcing_pause_campaign',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'sourcing_resume_campaign',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'sourcing_cancel_campaign',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'}},required:['userId','campaign_id']}}},
    { type:'function',function:{name:'sniper_collect_post',parameters:{type:'object',properties:{userId:{type:'string'},post_url:{type:'string'},limit:{type:'number'}},required:['userId','post_url']}}},
    { type:'function',function:{name:'sniper_poll_leads',parameters:{type:'object',properties:{userId:{type:'string'},target_id:{type:'string'},job_id:{type:'string'},limit:{type:'number'},cursor:{type:'string'}},required:['userId']}}},
    { type:'function',function:{name:'sniper_campaign_outreach_connect',parameters:{type:'object',properties:{userId:{type:'string'},campaign_id:{type:'string'},template_name:{type:'string'},max_count:{type:'number'}},required:['userId','template_name']}}},
    { type:'function',function:{name:'sniper_send_message_to_profile',parameters:{type:'object',properties:{userId:{type:'string'},profile_url:{type:'string'},lead_id:{type:'string'},template_name:{type:'string'},message:{type:'string'}},required:['userId']}}},
    { type:'function',function:{name:'sniper_update_settings',parameters:{type:'object',properties:{userId:{type:'string'},max_connects_per_day:{type:'number'},max_messages_per_day:{type:'number'},min_delay_seconds:{type:'number'},max_delay_seconds:{type:'number'},active_hours_start:{type:'string'},active_hours_end:{type:'string'},active_hours_days:{type:'string'},timezone:{type:'string'},safety_mode:{type:'boolean'},provider:{type:'string'},cloud_engine_enabled:{type:'boolean'},max_actions_per_day:{type:'number'},max_actions_per_hour:{type:'number'},cooldown_minutes:{type:'number'}},required:['userId']}}},
    { type:'function',function:{name:'sniper_get_status',parameters:{type:'object',properties:{userId:{type:'string'},job_id:{type:'string'}},required:['userId']}}},
    { type:'function', function:{ name:'send_campaign_email_by_template_name', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string'} }, required:['userId','campaign_id','template_name'] } } },
    { type:'function', function:{ name:'send_campaign_email_draft', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, subject:{type:'string'}, html:{type:'string'} }, required:['userId','campaign_id','subject','html'] } } },
    { type:'function', function:{ name:'preview_campaign_email', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string'}, template_name:{type:'string'} }, required:['userId','campaign_id'] } } },
    // Job Requisition tools
    { type:'function', function:{ name:'search_jobs', description:'Search user job requisitions by title.', parameters:{ type:'object', properties:{ userId:{type:'string'}, query:{type:'string'} }, required:['userId'] } } },
    { type:'function', function:{ name:'create_job_requisition', description:'Create a new job requisition with pipeline.', parameters:{ type:'object', properties:{ userId:{type:'string'}, title:{type:'string'}, description:{type:'string'}, department:{type:'string'}, location:{type:'string'}, salary_range:{type:'string'} }, required:['userId','title'] } } },
    { type:'function', function:{ name:'add_candidate_to_job', description:'Add a candidate to a job requisition pipeline stage. Defaults to first stage if stage not specified.', parameters:{ type:'object', properties:{ userId:{type:'string'}, candidateId:{type:'string'}, jobId:{type:'string'}, stage:{type:'string'} }, required:['userId','candidateId','jobId'] } } },
    { type:'function', function:{ name:'get_job_pipeline', description:'Get pipeline stages and candidates for a job requisition.', parameters:{ type:'object', properties:{ userId:{type:'string'}, jobId:{type:'string'} }, required:['userId','jobId'] } } },
    // Kanban tools
    { type:'function', function:{ name:'create_kanban_board', description:'Create a new Kanban board with custom columns.', parameters:{ type:'object', properties:{ userId:{type:'string'}, name:{type:'string'}, columns:{type:'array',items:{type:'string'}} }, required:['userId','name'] } } },
    { type:'function', function:{ name:'create_kanban_card', description:'Add a card to a Kanban board column.', parameters:{ type:'object', properties:{ userId:{type:'string'}, boardId:{type:'string'}, listId:{type:'string'}, title:{type:'string'}, description:{type:'string'} }, required:['userId','boardId','listId','title'] } } },
    { type:'function', function:{ name:'move_kanban_card', description:'Move a Kanban card to a different column.', parameters:{ type:'object', properties:{ userId:{type:'string'}, cardId:{type:'string'}, targetListId:{type:'string'} }, required:['userId','cardId','targetListId'] } } },
    // Persona / Template / Form / Sequence tools
    { type:'function', function:{ name:'create_persona', description:'Create an ideal candidate persona for sourcing. Define target titles, locations, and keywords.', parameters:{ type:'object', properties:{ userId:{type:'string'}, name:{type:'string'}, titles:{type:'array',items:{type:'string'}}, locations:{type:'array',items:{type:'string'}}, include_keywords:{type:'array',items:{type:'string'}}, exclude_keywords:{type:'array',items:{type:'string'}}, goal_total_leads:{type:'number'} }, required:['userId','name','titles'] } } },
    { type:'function', function:{ name:'generate_outreach_template', description:'AI-generate a personalized outreach email template and save it.', parameters:{ type:'object', properties:{ userId:{type:'string'}, template_name:{type:'string'}, job_title:{type:'string'}, company_or_context:{type:'string'}, tone:{type:'string',description:'professional, casual, or direct'} }, required:['userId','template_name','job_title'] } } },
    { type:'function', function:{ name:'create_screening_form', description:'Create a screening questionnaire for candidates. Auto-generates questions if not provided.', parameters:{ type:'object', properties:{ userId:{type:'string'}, title:{type:'string'}, job_title:{type:'string'}, questions:{type:'array',items:{type:'object',properties:{label:{type:'string'},field_type:{type:'string'},options:{type:'array',items:{type:'string'}}}}}, job_id:{type:'string'} }, required:['userId','title'] } } },
    { type:'function', function:{ name:'create_email_sequence', description:'Create a multi-step email sequence with delays between steps. Auto-generates 3-step sequence if steps not provided.', parameters:{ type:'object', properties:{ userId:{type:'string'}, name:{type:'string'}, steps:{type:'array',items:{type:'object',properties:{subject:{type:'string'},body:{type:'string'},delay_days:{type:'number'}}}}, stop_on_reply:{type:'boolean'} }, required:['userId','name'] } } },
    { type:'function', function:{ name:'classify_reply', description:'Reclassify a sourcing reply or manually override its classification label. Triggers auto-actions (pipeline move, sequence pause) when the label changes.', parameters:{ type:'object', properties:{ userId:{type:'string'}, replyId:{type:'string',description:'UUID of the sourcing_replies row'}, forceLabel:{type:'string',description:'Optional: manually set label instead of re-running AI. One of: positive|meeting_request|neutral|negative|oos|auto'} }, required:['userId','replyId'] } } },
    { type:'function', function:{ name:'score_candidates', description:'Score sourcing leads 0-100 against job requirements using AI. Filters out poor fits and prioritizes top matches. Persists scores to the database.', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string',description:'Campaign to score leads from'}, lead_ids:{type:'array',items:{type:'string'},description:'Optional: specific lead IDs to score. If omitted, scores all leads in campaign'}, job_title:{type:'string',description:'Job title for scoring context'}, job_description:{type:'string',description:'Job description for scoring context'}, min_score:{type:'number',description:'Minimum score threshold (0-100, default 40). Leads below this are flagged as poor fits.'} }, required:['userId'] } } },
    { type:'function', function:{ name:'check_lead_overlap', description:'Check for email overlaps between sourcing campaigns. Shows which leads already exist in other active campaigns to prevent duplicate outreach. Cross-campaign dedup runs automatically on lead insertion, but this tool lets users proactively check overlap.', parameters:{ type:'object', properties:{ userId:{type:'string'}, campaign_id:{type:'string',description:'Campaign to check leads from against other active campaigns'}, emails:{type:'array',items:{type:'string'},description:'Specific email addresses to check for overlap'} }, required:['userId'] } } },
    { type:'function', function:{ name:'create_ab_test', description:'Create an A/B test for a sequence step. Variant A = current content, Variant B = provided alternative. Auto-promotes winner after enough sends.', parameters:{ type:'object', properties:{ userId:{type:'string'}, sequence_id:{type:'string',description:'Message sequence ID'}, step_order:{type:'number',description:'Step number to A/B test (1, 2, or 3)'}, variant_b_subject:{type:'string',description:'Alternative subject line for Variant B'}, variant_b_body:{type:'string',description:'Alternative body HTML for Variant B'}, primary_metric:{type:'string',description:'Metric to optimize: reply_rate (default), open_rate, or click_rate'}, min_sends:{type:'number',description:'Minimum sends per variant before declaring winner (default 50)'} }, required:['userId','sequence_id','step_order','variant_b_subject','variant_b_body'] } } },
    { type:'function', function:{ name:'get_ab_results', description:'Get A/B test results for a sequence — per-variant open rates, reply rates, and winner recommendation.', parameters:{ type:'object', properties:{ userId:{type:'string'}, sequence_id:{type:'string',description:'Message sequence ID'}, step_order:{type:'number',description:'Optional: specific step to check. If omitted, returns all steps.'} }, required:['userId','sequence_id'] } } },
    { type:'function', function:{ name:'promote_ab_variant', description:'Manually promote an A/B test winner. All future sends for this step will use the winning variant.', parameters:{ type:'object', properties:{ userId:{type:'string'}, test_id:{type:'string',description:'A/B test ID'}, variant_id:{type:'string',description:'Variant ID to promote as winner'} }, required:['userId','test_id','variant_id'] } } },
    { type:'function', function:{ name:'get_pending_handoffs', description:'Get pending notification handoffs that need attention — unread replies, health alerts, milestones. Use this proactively at the start of conversations to surface items requiring action.', parameters:{ type:'object', properties:{ userId:{type:'string'}, type:{type:'string',description:'Optional filter: sourcing_reply, health_alert, milestone, reply_draft, meeting_draft'} }, required:['userId'] } } },
    { type:'function', function:{ name:'resolve_handoff', description:'Take action on a pending notification handoff — draft a reply, book a meeting, disqualify a lead, pause a campaign, etc. Marks the notification as handled.', parameters:{ type:'object', properties:{ userId:{type:'string'}, thread_key:{type:'string',description:'Thread key of the notification to act on'}, action_id:{type:'string',description:'Action to take: reply_draft, book_meeting, disqualify, snooze, pause_campaign, resume_campaign, send_draft'}, data:{type:'object',description:'Optional data for the action (e.g., {instruction: "mention our pricing"} for reply_draft)'} }, required:['userId','thread_key','action_id'] } } },
  ];
}

// ---------------------------------------------------------------------------
// Build system prompt (same as rexChat.ts)
// ---------------------------------------------------------------------------

type JobContext = {
  id: string; title: string; description: string; department: string;
  location: string; salary_range: string; pipeline_stages: string[]; candidate_count: number;
};

function buildSystemPrompt(userId: string, campaign_id?: string, jobCtx?: JobContext): any {
  let jobBlock = '';
  if (jobCtx) {
    jobBlock = `

**Current Job Context:**
You are assisting with: "${jobCtx.title}" (${jobCtx.department || 'No department'}) — Job ID: ${jobCtx.id}
Location: ${jobCtx.location || 'Not specified'} | Salary: ${jobCtx.salary_range || 'Not specified'}
Pipeline stages: ${jobCtx.pipeline_stages.join(' → ') || 'Default'}
Current candidates: ${jobCtx.candidate_count} in pipeline
Job description (summary): ${jobCtx.description.slice(0, 1500)}

Job-specific instructions:
- Use the job description above to inform sourcing criteria (target titles, skills, location, experience level).
- After sourcing and enrichment, convert leads to candidates using convert_lead_to_candidate, then add them to this job's pipeline using add_candidate_to_job (default to the first stage).
- Ask the user: "Should I track candidates in the job pipeline, or would you prefer a separate Kanban board?"
- You can also use create_kanban_board, create_kanban_card, and move_kanban_card if the user prefers Kanban tracking.`;
  } else {
    jobBlock = `

**Job context instructions:**
- When the user asks about sourcing or outreach for a role, ask: "Do you already have a job requisition for this role? If so, what's the name? I can search your jobs with search_jobs." If not, offer to create one with create_job_requisition.
- Once a job is identified, use add_candidate_to_job to place sourced candidates into the job's pipeline.`;
  }

  return {
    role: 'system',
    content: `You are REX, a recruiting and career AI assistant built into HirePilot. You help recruiters source leads, send outreach, manage campaigns, analyze resumes, and automate LinkedIn workflows.

Be conversational and concise — answer like a sharp colleague, not a manual. Use markdown formatting (bold, lists, headers) to keep responses scannable.

When you can fulfill a request with a tool, just do it. Don't describe a plan first — act, then summarize what happened. You have the tool schemas; use them directly.

Key behaviors:
- **Lead sourcing**: If the user wants leads but doesn't specify a source, ask once: "Apollo (fast, verified emails) or LinkedIn via Cloud Engine (browser automation)?" Default to Apollo if they don't answer.
- **Cloud Engine (Agent Mode)**: When the user provides a LinkedIn Sales Navigator URL or asks to scrape/pull leads from Sales Navigator, use **sniper_sn_lead_search** to queue a Cloud Engine extraction job. This uses browser automation (Browserbase + Playwright) to scrape lead profiles directly from the search results. After queuing, use **sniper_poll_leads** with the returned job_id to check results. Once profiles are extracted, use **sniper_import_to_leads** to import them into the campaign's lead list. For LinkedIn people search URLs (non-SN), use **sniper_people_search** instead. Use **sniper_get_status** to check if the Cloud Engine is enabled and LinkedIn is connected before running jobs. If it's not ready, tell the user to enable it at Settings → Cloud Engine.
- **Cloud Engine actions**: Use **sniper_sn_connect** to send Sales Navigator connection requests, **sniper_sn_inmail** to send InMail, and **sniper_sn_message** to message 1st-degree connections. Use **sniper_decision_makers** to find key people at a company, and **sniper_jobs_intent** for intent-based prospecting from job postings. Use **sniper_list_jobs** to show recent Cloud Engine activity.
- **Bulk actions**: Prefer campaign-level tools (send_campaign_email_auto, send_campaign_email_by_template_name) over single-lead tools when emailing a whole campaign.
- **Resume/LinkedIn help**: Use resume_intelligence (analyze first, rewrite on request, coach for strategy) and linkedin_intelligence. Be hiring-manager aware and outcome-focused — no ATS keyword stuffing.
- **Sequences**: If timing isn't provided for sequence steps, ask once for step delays (e.g., "0, 2, 4 business days").
- **Auto-track setup**: Gather persona, campaign, cadence, timing, and volume with brief back-and-forth — don't dump all questions at once.
- **Job tools**: Use search_jobs to find existing job requisitions, create_job_requisition to make new ones, get_job_pipeline to see pipeline state, and add_candidate_to_job to place candidates into job pipelines.
- **Kanban tools**: Use create_kanban_board, create_kanban_card, and move_kanban_card when users want visual board tracking.
- **Persona tools**: Use create_persona to build reusable sourcing profiles. When the user describes an ideal candidate, create a persona with titles, locations, and keywords.
- **Template tools**: Use generate_outreach_template to AI-draft personalized email templates. Use list_email_templates to check existing templates first.
- **Form tools**: Use create_screening_form to auto-generate screening questionnaires. Link to a job req when available.
- **Sequence tools**: Use create_email_sequence to build multi-step follow-up cadences. If the user doesn't specify steps, auto-generate a 3-step sequence.
- **Reply tools**: Use classify_reply to reclassify or manually override a reply's classification. Triggers auto-actions (pipeline move, sequence pause) when the label changes. Classifications: positive, meeting_request, neutral, negative, oos, auto.
- **Scoring tools**: Use score_candidates to pre-score leads before outreach. This scores leads 0-100 against job requirements and filters out poor fits. Always suggest scoring before launching outreach campaigns.
- **Lead overlap check**: Use check_lead_overlap before launching a new campaign to verify leads aren't already being contacted in other active campaigns. Cross-campaign dedup runs automatically on lead insertion, but this tool lets you proactively report on overlap.
- **A/B Testing**: Use create_ab_test to set up subject/body variants for sequence steps. Use get_ab_results to compare variant performance (open rate, reply rate). Use promote_ab_variant to manually lock in a winner. Auto-optimization runs automatically after 50+ sends per variant — winners are promoted and users notified.
- **Handoffs**: Use get_pending_handoffs to check for notifications that need attention — unread replies, health alerts, campaign milestones. Use resolve_handoff to act on them (draft a reply, book a meeting, disqualify a lead, pause a campaign). Proactively check for pending handoffs when the user starts a conversation to surface urgent items.

**Multi-step workflow plans:**
When the user requests a complex workflow (sourcing + enrichment + outreach, or any 3+ step process), respond with a numbered plan. Structure your response as:
1. **Source Candidates** — [describe what/where you'll source]
2. **Enrich Profiles** — [describe enrichment: emails, work history, etc.]
3. **Score & Rank** — [describe scoring criteria from the job requirements]
4. **Convert to Candidates** — [describe: convert top leads to candidates, add to job pipeline]
5. **Launch Outreach** — [describe: email sequence, personalized templates]

Use exactly these step patterns when applicable — the execution engine recognizes them:
- "Source" for sourcing (Apollo, LinkedIn, or Cloud Engine)
- "Enrich" for enrichment
- "Score" or "Rank" for scoring
- "Convert" or "Add to pipeline" for CRM actions
- "Outreach" or "Email" or "Sequence" for messaging

After presenting the plan, the user can approve it for automated execution. Each step runs in sequence with real tool calls.
${jobBlock}

Always pass userId="${userId}" when calling tools.${campaign_id ? ` Current campaign: ${campaign_id}.` : ''}`
  };
}

// ---------------------------------------------------------------------------
// Main streaming handler
// ---------------------------------------------------------------------------

export default async function rexChatStream(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const safeBody = req.body || {};
  const { userId, messages, campaign_id, conversationId, metadata } = safeBody as {
    userId?: string;
    messages?: { role: 'user' | 'assistant'; content: string }[];
    campaign_id?: string;
    conversationId?: string;
    metadata?: any;
  };

  if (!userId || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing userId or messages array' });
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  (res as any).flushHeaders?.();
  res.write('retry: 3000\n\n');

  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    try { res.end(); } catch {}
  };
  req.on('close', cleanup);

  const authHeader = req.headers.authorization || '';
  const internalUrl = process.env.BACKEND_INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;

  try {
    // 1. Validate user
    const { data: userRow, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    if (error) throw error;
    if (!userRow) {
      sseEvent(res, 'error', { message: 'User not found' });
      cleanup();
      return;
    }

    // 2. Run pre-processors
    const preResult = await runPreProcessors(messages, userId);
    if (preResult.handled && preResult.reply) {
      sseTokens(res, preResult.reply);
      // Ensure conversation + persist
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      let convId = await ensureConversation(internalUrl, conversationId, String(lastUserMsg?.content || 'New chat'), authHeader);
      if (convId && lastUserMsg) {
        await persistMessage(internalUrl, convId, 'user', { text: lastUserMsg.content }, authHeader);
      }
      if (convId) {
        await persistMessage(internalUrl, convId, 'assistant', { text: preResult.reply }, authHeader);
      }
      sseEvent(res, 'done', { conversation_id: convId, full_content: preResult.reply });
      cleanup();
      return;
    }

    // 3. Emit thinking status
    sseEvent(res, 'status', { phase: 'thinking' });

    const tools = getToolDefinitions();

    // Fetch job context if job_id passed in metadata
    let jobCtx: JobContext | undefined;
    if (metadata?.job_id) {
      try {
        const { data: job } = await supabase.from('job_requisitions').select('*').eq('id', metadata.job_id).maybeSingle();
        if (job) {
          const { data: stages } = await supabase.from('pipeline_stages').select('title').eq('pipeline_id', job.pipeline_id).order('position');
          const { count } = await supabase.from('candidate_jobs').select('id', { count: 'exact', head: true }).eq('job_id', job.id);
          jobCtx = {
            id: job.id, title: job.title || '',
            description: (job.description || '').slice(0, 2000),
            department: job.department || '', location: job.location || '',
            salary_range: job.salary_range || '',
            pipeline_stages: (stages || []).map((s: any) => s.title),
            candidate_count: count || 0
          };
        }
      } catch (e) {
        console.error('[rexChatStream] job context fetch error', e);
      }
    }

    const contextMessage = buildSystemPrompt(userId, campaign_id, jobCtx);

    // 4. First OpenAI call (streaming)
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [contextMessage, ...messages],
      tools,
      stream: true,
    });

    let contentAccum = '';
    const toolCallsAccum: Array<{ id: string; function: { name: string; arguments: string } }> = [];

    for await (const chunk of stream) {
      if (cleaned) break;
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // Stream text tokens
      if (delta.content) {
        contentAccum += delta.content;
        sseEvent(res, 'token', { t: delta.content });
      }

      // Accumulate tool call fragments
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallsAccum[idx]) {
            toolCallsAccum[idx] = { id: '', function: { name: '', arguments: '' } };
          }
          if (tc.id) toolCallsAccum[idx].id = tc.id;
          if (tc.function?.name) toolCallsAccum[idx].function.name += tc.function.name;
          if (tc.function?.arguments) toolCallsAccum[idx].function.arguments += tc.function.arguments;
        }
      }
    }

    // Setup conversation persistence
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    let convId = await ensureConversation(internalUrl, conversationId, String(lastUserMsg?.content || 'New chat'), authHeader);
    if (convId && lastUserMsg) {
      await persistMessage(internalUrl, convId, 'user', { text: lastUserMsg.content }, authHeader);
    }

    // 5. No tool calls — apply post-processors and finish
    if (toolCallsAccum.length === 0) {
      const final = applyPostProcessors(contentAccum, null, false, messages);
      if (final !== contentAccum) {
        sseEvent(res, 'replace', { full_content: final });
      }
      sseEvent(res, 'done', { conversation_id: convId, full_content: final });
      if (convId) {
        await persistMessage(internalUrl, convId, 'assistant', { text: final }, authHeader);
      }
      try { await completeOnboardingStep(userId, 'rex_chat_activated', {}); } catch {}
      cleanup();
      return;
    }

    // 6. Tool execution phase
    sseEvent(res, 'status', { phase: 'tools' });

    const { server: rexServer } = await import('../rex/server');
    const capabilities = rexServer.getCapabilities?.();

    // Build the assistant message with tool_calls for the messages array
    const assistantToolMsg: any = {
      role: 'assistant',
      content: contentAccum || null,
      tool_calls: toolCallsAccum.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments }
      }))
    };

    const updatedMessages: any[] = [contextMessage, ...messages, assistantToolMsg];
    let executedSourcing = false;
    let lastToolResult: any = null;

    for (const call of toolCallsAccum) {
      const toolName = call.function.name;
      if (!toolName) continue;

      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        args = call.function.arguments;
      }

      sseEvent(res, 'tool_start', { name: toolName, call_id: call.id });

      // Tool-specific arg prep (source_leads campaign creation, send_campaign_email_auto latest resolution)
      try {
        if (toolName === 'source_leads') {
          const titleGuess = (String(lastUserMsg?.content || '').match(/find\s+\d+\s+(.+?)\s+in/i)?.[1] || 'Sourcing Campaign').slice(0, 80);
          try {
            const { data: newCamp, error: newErr } = await supabase
              .from('sourcing_campaigns')
              .insert({ title: titleGuess, created_by: userId, audience_tag: 'rex' })
              .select('id')
              .single();
            if (newErr) throw newErr;
            args.campaignId = newCamp.id;
            await supabase
              .from('rex_user_context')
              .upsert({ supabase_user_id: userId, latest_campaign_id: newCamp.id }, { onConflict: 'supabase_user_id' });
          } catch {
            args.campaignId = `new_${Date.now()}`;
          }
        }
        if (toolName === 'send_campaign_email_auto') {
          const cid = String(args?.campaign_id || '').trim();
          const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cid);
          if (!cid || cid === 'latest' || !looksUuid) {
            const { data: latest } = await supabase
              .from('campaigns')
              .select('id,created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (latest?.id) args.campaign_id = latest.id;
          }
        }
      } catch {}

      // Execute tool
      if (!capabilities?.tools?.[toolName]?.handler) {
        updatedMessages.push({
          role: 'tool', tool_call_id: call.id, name: toolName,
          content: JSON.stringify({ error: `Tool handler not found for ${toolName}` })
        });
        sseEvent(res, 'tool_end', { name: toolName, call_id: call.id });
        continue;
      }

      let toolResult: any = null;
      try {
        toolResult = await withTimeout(capabilities.tools[toolName].handler(args), 45000);
      } catch (toolErr: any) {
        console.error('[rexChatStream] tool error', toolName, toolErr?.message || toolErr);
        toolResult = { error: String(toolErr?.message || toolErr) };
      }

      lastToolResult = toolResult;
      executedSourcing = executedSourcing || ['source_leads', 'filter_leads'].includes(toolName);

      updatedMessages.push({
        role: 'tool', tool_call_id: call.id, name: toolName,
        content: JSON.stringify(toolResult)
      });

      sseEvent(res, 'tool_end', { name: toolName, call_id: call.id });
    }

    // 7. Check if post-processor will deterministically override
    const willOverride =
      (lastToolResult && lastToolResult.error === 'NO_EMAIL_PROVIDER') ||
      (lastToolResult && lastToolResult.error_code === 'CLOUD_ENGINE_DISABLED' && lastToolResult.help);

    if (willOverride) {
      const overriddenContent = applyPostProcessors('', lastToolResult, executedSourcing, messages);
      sseTokens(res, overriddenContent);
      sseEvent(res, 'done', { conversation_id: convId, full_content: overriddenContent });
      if (convId) {
        await persistMessage(internalUrl, convId, 'assistant', { text: overriddenContent }, authHeader);
      }
      try { await completeOnboardingStep(userId, 'rex_chat_activated', {}); } catch {}
      cleanup();
      return;
    }

    // 8. Stream final response after tools
    sseEvent(res, 'status', { phase: 'responding' });

    const finalStream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: updatedMessages,
      stream: true,
    });

    let finalContent = '';
    for await (const chunk of finalStream) {
      if (cleaned) break;
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        finalContent += delta.content;
        sseEvent(res, 'token', { t: delta.content });
      }
    }

    // Apply non-deterministic post-processors (campaign links, outreach nudge)
    const processed = applyPostProcessors(finalContent, lastToolResult, executedSourcing, messages);
    if (processed !== finalContent) {
      sseEvent(res, 'replace', { full_content: processed });
      finalContent = processed;
    }

    sseEvent(res, 'done', { conversation_id: convId, full_content: finalContent });

    if (convId) {
      await persistMessage(internalUrl, convId, 'assistant', { text: finalContent }, authHeader);
    }

    try { await completeOnboardingStep(userId, 'rex_chat_activated', {}); } catch {}
    cleanup();

  } catch (err: any) {
    console.error('[rexChatStream] Error:', err?.stack || err);
    sseEvent(res, 'error', { message: err?.message || 'Internal server error' });
    cleanup();
  }
}
