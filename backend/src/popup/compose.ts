import { CATALOG } from './catalog';
import { matchCatalog } from './match';
import { widgetTools } from '../rex/widgetTools';

async function callMCP(name: string, args: any) {
  const tool = widgetTools[`rex_widget_support_${name}`];
  if (!tool) return null;
  try { return await tool.handler(args || {}); } catch { return null; }
}

function formatPricingDelta(p:any){ if(!p||!Array.isArray(p.tiers)||!p.tiers.length) return ''; return p.tiers.map((t:any)=>`- ${t.name}${t.summary?`: ${t.summary}`:''}${t.price?` (${t.price})`:''}`).join('\n'); }
function formatFeatures(p:any){ if(!p||!Array.isArray(p.features)) return ''; return p.features.slice(0,4).map((f:any)=>`- ${f.name}: ${f.description}`).join('\n'); }
function formatFlow(flow:any, readiness:any){ if(!flow?.steps) return ''; return flow.steps.map((s:string,i:number)=>`${i+1}. ${s}`).join('\n'); }

function finalize(o:{text:string; sources?:{title:string,url:string}[]; tutorial?:any; ctas?:string[]; needs_escalation?:boolean}){
  return { text:o.text, sources:o.sources||[], tutorial:o.tutorial||null, ctas:o.ctas||[], needs_escalation:!!o.needs_escalation };
}

export async function answerPopup(question:string, ctx:{userId?:string|null}){
  const m = await matchCatalog(question);
  if (m.entry){
    const base = m.entry;
    const sources: {title:string,url:string}[] = [];
    let extra='';
    if (base.intentTop==='sales'){
      if (base.intentSub==='pricing' || base.intentSub==='plan_diff'){
        const p = await callMCP('get_pricing_overview', {});
        extra = formatPricingDelta(p);
        sources.push({title:'Pricing', url:'https://thehirepilot.com/pricing'});
      } else if (base.intentSub==='comparison' || base.intentSub==='product_value'){
        const f = await callMCP('get_feature_overview', {});
        extra = formatFeatures(f);
        sources.push({title:'Overview', url: base.sourceSlug || 'https://thehirepilot.com/'});
      }
    } else {
      const map:any = { launch_campaign:'launch_campaign', import_leads:'import_leads', connect_email:'connect_email', followups:'set_followups' };
      const flowKey = map[base.intentSub];
      if (flowKey){
        const flow = await callMCP('get_flow_steps', { flow: flowKey });
        extra = formatFlow(flow, {});
        if (flow?.source_url) sources.push({title:flow.title||'Steps', url: flow.source_url});
      } else {
        const s = await callMCP('search_support', { q: question, top_k: 3 });
        if (s?.results?.length) sources.push(...s.results.slice(0,2).map((r:any)=>({title:r.title,url:r.url})));
      }
    }
    return finalize({ text:[base.answer, extra].filter(Boolean).join('\n\n'), sources, ctas: base.ctas || ['demo','calendly','human'] });
  }
  const s = await callMCP('search_support', { q: question, top_k: 5 });
  if (s?.results?.length){
    return finalize({ text:'Here’s what I found:', sources: s.results.slice(0,3).map((r:any)=>({title:r.title,url:r.url})), ctas:['demo','calendly','human'] });
  }
  return finalize({ text:`I don’t have a verified answer for that yet. Want a walkthrough or to chat with a human?`, sources:[], ctas:['demo','calendly','human'], needs_escalation:true });
}


