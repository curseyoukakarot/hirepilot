import { Router } from 'express';
import requireAuthUnified from '../../middleware/requireAuthUnified';
import { sourcingRunPersonaTool } from '../mcp/sourcing.run_persona';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { buildSourcingQuery } from '../lib/personaMapper';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const CALM_REX_SYSTEM_PROMPT =
  'You are REX, an AI Recruiting Agent inside HirePilot. Mode: Calm Professional Assistant. Be concise and neutral. Use personas to guide sourcing. When asked to source, schedule, or edit personas, offer 2 clear options, not more. Avoid exclamation marks. Never assume user intent; confirm next step.';

router.post('/send-message', requireAuthUnified as any, async (req, res) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { message = '', personaId, action, args = {} } = req.body || {};

    // Handle action buttons first
    if (action) {
      if (action === 'run_now') {
        try {
          // Load persona to construct search
          const { data: persona, error: pErr } = await supabaseAdmin
            .from('personas')
            .select('*')
            .eq('id', personaId)
            .eq('user_id', userId)
            .single();
          if (pErr || !persona) throw new Error('Persona not found');

          // Build Apollo search params
          const targeting = buildSourcingQuery({
            name: persona.name,
            titles: persona.titles || [],
            include_keywords: persona.include_keywords || [],
            exclude_keywords: persona.exclude_keywords || [],
            locations: persona.locations || [],
            channels: persona.channels || []
          } as any);

          const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || `http://127.0.0.1:${process.env.PORT || 8080}`;
          // 1) Search Apollo (returns leads array; does NOT import)
          const searchBody: any = {
            jobTitle: (targeting.title_query || [])[0] || '',
            keywords: (targeting.keyword_includes || []).join(' '),
            location: (targeting.locations || [])[0] || undefined,
            booleanSearch: (targeting.title_query || []).some(t => /AND|OR|NOT|\(|\)/i.test(t))
          };

          const headers: any = { 'Content-Type': 'application/json' };
          if (req.headers.cookie) headers['Cookie'] = String(req.headers.cookie);
          if (req.headers.authorization) headers['Authorization'] = String(req.headers.authorization);

          const resp = await fetch(`${BACKEND_INTERNAL}/api/leads/apollo/search`, { method: 'POST', headers, body: JSON.stringify(searchBody) });
          if (!resp.ok) {
            const errText = await resp.text().catch(()=> '');
            throw new Error(errText || `apollo search failed (${resp.status})`);
          }
          const searchData = await resp.json().catch(()=>({}));
          const leads = Array.isArray(searchData?.leads) ? searchData.leads : [];
          if (!leads.length) {
            const loc = searchBody?.location ? ` in ${String(searchBody.location)}` : '';
            return res.json({
              message: `I didn’t find any leads${loc}. Want me to broaden the location/keywords or adjust the persona filters?`,
              actions: [ { label: 'Broaden Search', value: 'refine' }, { label: 'Modify Persona', value: 'refine' } ]
            });
          }

          // Ensure campaign (only create after we know we have results)
          const { data: campRow, error: cErr } = await supabaseAdmin
            .from('sourcing_campaigns')
            .insert({ title: `Persona • ${persona.name}`, created_by: userId, audience_tag: 'rex' })
            .select('id')
            .single();
          if (cErr) throw new Error(cErr.message);
          const effectiveCampaignId = (campRow as any).id as string;

          // 2) Import into SOURCING campaign (correct FK: sourcing_campaigns -> sourcing_leads)
          const mapped = leads.map((l: any) => ({
            name: [l.firstName, l.lastName].filter(Boolean).join(' ').trim() || undefined,
            title: l.title || undefined,
            company: l.company || undefined,
            linkedin_url: l.linkedinUrl || undefined,
            email: l.email || undefined,
            domain: undefined
          }));
          const addBody = { leads: mapped, source: 'apollo' };
          const addResp = await fetch(`${BACKEND_INTERNAL}/api/sourcing/campaigns/${effectiveCampaignId}/leads`, { method: 'POST', headers, body: JSON.stringify(addBody) });
          if (!addResp.ok) {
            const errText = await addResp.text().catch(()=> '');
            throw new Error(errText || `sourcing add failed (${addResp.status})`);
          }
          const addData = await addResp.json().catch(()=>({ inserted: mapped.length }));
          const added = Number(addData?.inserted || (mapped?.length || 0));

          // 3) Mirror to classic campaigns/leads so it appears on /campaigns and /leads
          try {
            // Create a classic campaign row
            const classicTitle = `Persona • ${persona.name}`;
            const createClassic = await fetch(`${BACKEND_INTERNAL}/api/saveCampaign`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ user_id: userId, campaignName: classicTitle, status: 'draft' })
            });
            let classicCampaignId: string | undefined;
            if (createClassic.ok) {
              const classic = await createClassic.json().catch(()=>null);
              classicCampaignId = classic?.campaign?.id;
            }
            // Fallback: direct insert if route unavailable
            if (!classicCampaignId) {
              const { data: classicRow, error: classicErr } = await supabaseAdmin
                .from('campaigns')
                .insert({ user_id: userId, title: classicTitle, status: 'draft' })
                .select('id')
                .single();
              if (!classicErr && classicRow) classicCampaignId = (classicRow as any).id;
            }

            if (classicCampaignId) {
              const leadsForClassic = (leads || []).map((l: any) => ({
                first_name: l.firstName || '',
                last_name: l.lastName || '',
                name: [l.firstName, l.lastName].filter(Boolean).join(' ').trim(),
                email: l.email || '',
                title: l.title || '',
                company: l.company || '',
                linkedin_url: l.linkedinUrl || null,
                city: l.city || null,
                state: l.state || null,
                country: l.country || null
              }));

              const importClassic = await fetch(`${BACKEND_INTERNAL}/api/leads/import`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ campaignId: classicCampaignId, leads: leadsForClassic, source: 'apollo', searchCriteria: searchBody })
              });
              if (!importClassic.ok) {
                // Non-fatal; continue
                const errText = await importClassic.text().catch(()=> '');
                console.warn('classic import failed', errText);
              }
            }
          } catch (mirrorErr) {
            console.warn('Mirror to classic campaigns/leads failed (non-fatal):', (mirrorErr as any)?.message || mirrorErr);
          }
          return res.json({
            message: `Added ${added} new leads (Apollo). Charged ${added} credits (1/lead).`,
            actions: [ { label: 'Start Outreach', value: 'start_outreach' }, { label: 'Add More Filters', value: 'refine' } ],
          });
        } catch (e: any) {
          return res.status(400).json({ message: e?.message || 'Run failed' });
        }
      }
      if (action === 'start_outreach') {
        try {
          // 1) Resolve the most recent classic campaign for this user (mirror created during run_now)
          const { data: latestCamp } = await supabaseAdmin
            .from('campaigns')
            .select('id,title,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const classicId = (latestCamp as any)?.id as string | undefined;
          if (!classicId) throw new Error('No campaign found to send outreach. Run sourcing first.');

          // 2) If caller provided subject/html, use them; otherwise generate a concise opener
          let subj: string | undefined = args?.subject;
          let html: string | undefined = args?.html;
          if (!subj || !html) {
            // Load persona context when available to improve copy
            let persona: any = null;
            if (personaId) {
              const { data: p } = await supabaseAdmin
                .from('personas')
                .select('*')
                .eq('id', personaId)
                .eq('user_id', userId)
                .maybeSingle();
              persona = p || null;
            }
            const sys = 'Write a short, professional outreach email opener for a recruiting campaign. Keep to 4-6 sentences, no fluff, no exclamation marks. Include a Calendly style CTA line at the end if appropriate.';
            const context = persona ? `Persona: ${persona.name}; Titles: ${(persona.titles||[]).join(', ')}; Includes: ${(persona.include_keywords||[]).join(', ')}; Locations: ${(persona.locations||[]).join(', ')}` : '';
            const prompt = `${sys}\n${context}\nReturn JSON with keys subject, html.`;
            const comp = await openai.chat.completions.create({ model:'gpt-4o-mini', messages:[{ role:'user', content: prompt }] });
            try {
              const t = comp.choices?.[0]?.message?.content || '';
              const parsed = JSON.parse(t);
              subj = parsed.subject || 'Quick intro';
              html = parsed.html || '<p>Quick intro</p>';
            } catch {
              subj = 'Quick introduction';
              html = '<p>Hi, I wanted to introduce myself and share a quick opportunity. Are you open to a short chat?</p>';
            }
          }

          // 3) Use REX tool to queue messages to the campaign (supports draft mode)
          // Invoke capabilities from rex/server
          const { server } = await import('../rex/server');
          const caps = (server as any)?.getCapabilities?.();
          const tool = caps?.tools?.['send_campaign_email_auto'];
          if (!tool?.handler) throw new Error('Email tool unavailable');
          const result = await tool.handler({ userId, campaign_id: classicId, subject: subj, html, channel: 'sendgrid' });
          return res.json({ message: `Queued ${result?.queued || 0} emails to your latest campaign.`, actions: [ { label:'View Campaign', value:'view_campaign' } ] });
        } catch (e: any) {
          return res.status(400).json({ message: e?.message || 'Outreach failed' });
        }
      }
      if (action === 'schedule') {
        return res.json({ message: 'Should I set it for a specific date or make it recurring?', actions: [ { label: 'One-Time', value: 'one_time' }, { label: 'Recurring', value: 'recurring' } ] });
      }
      // Basic fallthrough
      return res.json({ message: 'Understood.' });
    }

    const text: string = String(message || '').toLowerCase();
    const isGreeting = /^(hi|hello|hey|yo|gm|good\smorning|good\safternoon|good\sevening)\b/.test(text) || /\bhello\s*rex\b/.test(text);
    if (isGreeting) {
      return res.json({
        message: 'Hello — I\'m REX. How can I help today? I can source leads, schedule automations, or refine a persona.',
        actions: [
          { label: 'Run Now', value: 'run_now' },
          { label: 'Schedule', value: 'schedule' },
          { label: 'Modify Persona', value: 'refine' }
        ]
      });
    }
    if (text.startsWith('/source') || /(find|source|sourcing|prospect)/.test(text)) {
      return res.json({
        message: personaId ? `Would you like me to start sourcing using your active persona?` : 'Would you like me to start sourcing using your active persona?',
        actions: [ { label: 'Run Now', value: 'run_now' }, { label: 'Schedule', value: 'schedule' } ]
      });
    }
    if (text.startsWith('/schedule') || /schedule/.test(text)) {
      return res.json({ message: 'I can schedule this. Daily or weekly?', actions: [ { label: 'Daily', value: 'schedule_daily' }, { label: 'Weekly', value: 'schedule_weekly' } ] });
    }
    if (text.startsWith('/refine') || /persona|title|location|keyword/.test(text)) {
      return res.json({ message: 'What would you like to modify in your persona?', actions: [ { label: 'Titles', value: 'refine_titles' }, { label: 'Locations', value: 'refine_locations' }, { label: 'Filters', value: 'refine_filters' } ] });
    }

    // 4) Default: delegate to rexChat (tools + OpenAI) for full capability
    try {
      const { default: rexChat } = await import('../api/rexChat');
      const fakeReq: any = {
        method: 'POST',
        headers: req.headers,
        path: '/api/agent/send-message',
        body: {
          userId,
          messages: [ { role: 'user', content: String(message || '') } ]
        }
      };
      const fakeRes: any = {
        status: (code: number) => ({ json: (obj: any) => res.status(code).json({ message: obj?.reply?.content || obj?.message || 'Understood. How would you like to proceed?' }) }),
        json: (obj: any) => res.json({ message: obj?.reply?.content || obj?.message || 'Understood. How would you like to proceed?' }),
        set: () => {}
      };
      return rexChat(fakeReq, fakeRes);
    } catch (e: any) {
      console.error('agentChat -> rexChat error', e?.message || e);
      return res.json({ message: 'Understood. How would you like to proceed?' });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'chat failed' });
  }
});

export default router;


