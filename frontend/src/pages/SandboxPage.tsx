import React, { useEffect, useState } from 'react';
// Supabase client import path fallback
let supabase: any = null;
try { supabase = require('../lib/supabaseClient').supabase; } catch {}
try { if (!supabase) supabase = require('../../lib/supabaseClient').supabase; } catch {}
import { getSchemaForEndpoint, nodeSchemas } from '../config/nodeSchemas';

export default function SandboxPage() {
  const [selectedNode, setSelectedNode] = useState<{ id?: string; title: string; endpoint: string; type: 'Trigger' | 'Action' } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalState, setModalState] = useState<any>({ mode: 'guided', availableData: [], guidedDefaults: null, developerDefaults: null, preview: '' });
  useEffect(() => {
    // Dynamic presets per node (title/endpoint/type)
    const getPresetFor = (node?: { title?: string; endpoint?: string; type?: string }) => {
      const ep = String(node?.endpoint || '').toLowerCase();
      const isAction = (node?.type || '').toLowerCase() === 'action' || ep.includes('/api/actions/');
      // Defaults
      const preset = {
        nodeName: node?.title || 'Node',
        candidateName: '{{candidate.name}}',
        jobTitle: '{{job.title}}',
        channel: isAction ? '#general' : '#hiring-alerts',
        template: '⚡ {{candidate.name}} → {{job.title}}',
        sample: {
          candidate: { name: 'Sarah Johnson', email: 'sarah@example.com' },
          job: { title: 'Senior Frontend Developer', department: 'Engineering' },
          lead: { source: 'Apollo' },
          client: { name: 'Acme Inc.' },
          pipeline: { stage: 'Offer' }
        }
      };
      const set = (o: Partial<typeof preset>) => Object.assign(preset, o);
      // Triggers
      if (ep.includes('candidate_hired')) set({ nodeName: 'Slack Hire Alert', channel: '#hiring-alerts', template: '🎉 {{candidate.name}} hired for {{job.title}}!' });
      else if (ep.includes('lead_created')) set({ nodeName: 'New Lead Alert', channel: '#leads', template: '🆕 New lead: {{candidate.name}} ({{lead.source}})' });
      else if (ep.includes('lead_tagged')) set({ nodeName: 'Lead Tagged Alert', channel: '#leads', template: '🏷️ {{candidate.name}} tagged – notify team' });
      else if (ep.includes('lead_source_triggered')) set({ nodeName: 'Lead Source Detected', channel: '#leads', template: '🔗 Source: {{lead.source}} – {{candidate.name}}' });
      else if (ep.includes('campaign_relaunched')) set({ nodeName: 'Campaign Relaunch', channel: '#campaigns', template: '🚀 Campaign relaunched – auditing sequences' });
      else if (ep.includes('candidate_updated')) set({ nodeName: 'Candidate Updated', channel: '#updates', template: '📝 {{candidate.name}} updated (syncing records)' });
      else if (ep.includes('pipeline_stage_updated')) set({ nodeName: 'Stage Changed', channel: '#pipeline', template: '🔄 {{candidate.name}} moved to {{pipeline.stage}}' });
      else if (ep.includes('client_created')) set({ nodeName: 'Client Created', channel: '#clients', template: '🏢 New client: {{client.name}}' });
      else if (ep.includes('client_updated')) set({ nodeName: 'Client Updated', channel: '#clients', template: '♻️ Client updated: {{client.name}}' });
      else if (ep.includes('job_created')) set({ nodeName: 'New Job Req', channel: '#jobs', template: '📄 New role opened – {{job.title}}' });
      // Actions
      if (ep.includes('/api/actions/send_email_template')) set({ nodeName: 'Email Template', channel: '#general', template: '📧 Emailing {{candidate.name}} re: {{job.title}}' });
      if (ep.includes('/api/actions/notifications')) set({ nodeName: 'Slack Notification', channel: '#alerts', template: '🔔 Update: {{candidate.name}} – {{job.title}}' });
      if (ep.includes('/api/actions/sync_enrichment')) set({ nodeName: 'Sync Enrichment', channel: '#enrichment', template: '🧠 Enriching {{candidate.name}}' });
      if (ep.includes('/api/actions/invoices_create')) set({ nodeName: 'Create Invoice', channel: '#billing', template: '💸 Invoice generated for {{client.name}}' });
      if (ep.includes('/api/actions/add_note')) set({ nodeName: 'Add Deal Note', channel: '#pipeline', template: '📝 Note added for {{candidate.name}}' });
      if (ep.includes('/api/actions/add_collaborator')) set({ nodeName: 'Add Collaborator', channel: '#team', template: '👥 Invited collaborator to {{job.title}}' });
      if (ep.includes('/api/actions/update_pipeline_stage')) set({ nodeName: 'Update Stage', channel: '#pipeline', template: '➡️ Moving {{candidate.name}} to next stage' });
      return preset;
    };

    const applyPresetToModal = (preset: any, nodeTitle?: string) => {
      const nodeNameInput = document.querySelector('#config-fields input[type="text"]') as HTMLInputElement | null; // first is Node Name
      const textInputs = Array.from(document.querySelectorAll('#config-fields input[type="text"]')) as HTMLInputElement[];
      const candidateInput = textInputs[1];
      const jobInput = textInputs[2];
      const channelSelect = document.querySelector('#config-fields select') as HTMLSelectElement | null;
      const messageTextarea = document.querySelector('#config-fields textarea') as HTMLTextAreaElement | null;
      if (nodeNameInput) nodeNameInput.value = preset.nodeName || preset.name || nodeTitle || nodeNameInput.value;
      if (candidateInput) candidateInput.value = preset.candidateName;
      if (jobInput) jobInput.value = preset.jobTitle;
      if (channelSelect) channelSelect.value = preset.channel;
      if (messageTextarea) messageTextarea.value = preset.template;
      // Live preview
      const pv = document.querySelector('#sample-preview p') as HTMLElement | null;
      if (pv) {
        const rendered = preset.template
          .replaceAll('{{candidate.name}}', preset.sample.candidate.name)
          .replaceAll('{{job.title}}', preset.sample.job.title)
          .replaceAll('{{job.department}}', preset.sample.job.department)
          .replaceAll('{{lead.source}}', preset.sample.lead.source)
          .replaceAll('{{client.name}}', preset.sample.client.name)
          .replaceAll('{{pipeline.stage}}', preset.sample.pipeline.stage);
        pv.textContent = rendered;
      }
    };
    let isDragging = false as boolean;
    let draggedElement: HTMLElement | null = null;
    const dragOffset = { x: 0, y: 0 } as { x: number; y: number };

    const sidebar = document.getElementById('sidebar');
    const canvas = document.getElementById('main-canvas');
    const dropZone = document.getElementById('drop-zone') as HTMLElement | null;

    if (!sidebar || !canvas) return;

    const onDragStart = (e: DragEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.classList.contains('trigger-node') || t.classList.contains('action-node'))) {
        isDragging = true;
        draggedElement = t.cloneNode(true) as HTMLElement;
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      if (dropZone) dropZone.style.opacity = '1';
    };

    const onDragLeave = (e: DragEvent) => {
      const related = e.relatedTarget as Node | null;
      if (canvas && (!related || !canvas.contains(related))) {
        if (dropZone) dropZone.style.opacity = '0';
      }
    };

    const inferSlugFromTitle = (title: string) => {
      const t = String(title || '').toLowerCase();
      const map: Record<string, string> = {
        'candidate hired': 'candidate_hired',
        'lead created': 'lead_created',
        'lead tagged': 'lead_tagged',
        'lead source detected': 'lead_source_triggered',
        'campaign relaunched': 'campaign_relaunched',
        'candidate updated': 'candidate_updated',
        'pipeline stage changed': 'pipeline_stage_updated',
        'client created': 'client_created',
        'client updated': 'client_updated',
        'job req created': 'job_created',
        'universal event feed': 'events',
        // actions
        'send email template': 'send_email_template',
        'send slack notification': 'notifications',
        'sync enrichment': 'sync_enrichment',
        'create client': 'create_client',
        'create invoice': 'invoices_create',
        'add deal note': 'add_note',
        'add collaborator': 'add_collaborator',
        'update pipeline stage': 'update_pipeline_stage',
        'trigger rex chat': 'rex_chat'
      };
      return map[t];
    };

    const makeNodeClickable = (node: HTMLElement) => {
      node.addEventListener('click', () => {
        if (isDragging) return;
        const title = (node.querySelector('h3') as HTMLElement)?.textContent || 'Node';
        // Prefer text-xs element that contains '/api/' so we don't grab the small label "Trigger"
        let endpoint = '';
        try {
          const candidates = Array.from(node.querySelectorAll('.text-xs')) as HTMLElement[];
          const match = candidates.find((el) => (el.textContent || '').includes('/api/'));
          endpoint = (match?.textContent || '').trim();
        } catch {}
        const type = (node.querySelector('p.text-xs')?.textContent || '').includes('Action') ? 'Action' : 'Trigger';
        if (!endpoint || !endpoint.includes('/api/')) {
          const slug = inferSlugFromTitle(title);
          if (slug) endpoint = `/${type === 'Action' ? 'api/actions' : 'api/events'}/${slug}`;
        }
        setSelectedNode({ id: `${Date.now()}-${Math.random()}`, title, endpoint, type: type as any });
        openNodeModal({ title, endpoint, type });
      });
    };

    const makeNodeDraggable = (node: HTMLElement) => {
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const x = e.clientX - canvasRect.left - dragOffset.x;
          const y = e.clientY - canvasRect.top - dragOffset.y;
          node.style.left = Math.max(0, Math.min(x, canvasRect.width - 256)) + 'px';
          node.style.top = Math.max(0, Math.min(y, canvasRect.height - 100)) + 'px';
        }
      };
      const handleMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      node.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = node.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });
      makeNodeClickable(node);
    };

    const extractNodeData = (element: HTMLElement) => {
      const title = (element.querySelector('.font-medium') as HTMLElement)?.textContent || '';
      const endpoint = (element.querySelector('.text-xs.text-gray-400') as HTMLElement)?.textContent || '';
      const icon = (element.querySelector('span') as HTMLElement)?.textContent || '';
      return { title, endpoint, icon };
    };

    const createWorkflowNode = (sourceElement: HTMLElement, x: number, y: number) => {
      const isAction = sourceElement.classList.contains('action-node');
      const nodeData = extractNodeData(sourceElement);
      const workflowNode = document.createElement('div');
      workflowNode.className = 'absolute transform transition-all duration-200 hover:scale-105';
      workflowNode.style.left = x - 128 + 'px';
      workflowNode.style.top = y - 50 + 'px';
      workflowNode.style.cursor = 'move';
      workflowNode.innerHTML = `
            <div class="bg-gradient-to-br ${isAction ? 'from-purple-600 to-purple-800' : 'from-blue-600 to-blue-800'} p-4 rounded-xl shadow-lg border ${isAction ? 'border-purple-400/20 node-glow-purple' : 'border-blue-400/20 node-glow'} w-64">
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-2xl">${nodeData.icon}</span>
                    <div>
                        <h3 class="font-semibold text-white">${nodeData.title}</h3>
                        <p class="text-xs ${isAction ? 'text-purple-200' : 'text-blue-200'}">${isAction ? 'Action' : 'Trigger'}</p>
                    </div>
                </div>
                <div class="text-xs ${isAction ? 'text-purple-100 bg-purple-900/30' : 'text-blue-100 bg-blue-900/30'} rounded-md px-2 py-1">
                    ${nodeData.endpoint}
                </div>
                <div class="absolute ${isAction ? '-left-2' : '-right-2'} top-1/2 transform -translate-y-1/2 w-4 h-4 ${isAction ? 'bg-purple-400' : 'bg-blue-400'} rounded-full border-2 border-white shadow-lg"></div>
            </div>
        `;
      canvas.appendChild(workflowNode);
      makeNodeDraggable(workflowNode);
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (dropZone) dropZone.style.opacity = '0';
      if (draggedElement && canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        createWorkflowNode(draggedElement, x, y);
        draggedElement = null;
      }
    };

    // Make existing nodes draggable and clickable on mount
    document.querySelectorAll('[id^="workflow-node-"]').forEach((n) => makeNodeDraggable(n as HTMLElement));

    sidebar.addEventListener('dragstart', onDragStart as any);
    canvas.addEventListener('dragover', onDragOver as any);
    canvas.addEventListener('dragleave', onDragLeave as any);
    canvas.addEventListener('drop', onDrop as any);

    // Modal logic wiring
    const overlay = document.getElementById('modal-overlay');
    const guidedModeBtn = document.getElementById('guided-mode-btn');
    const devModeBtn = document.getElementById('dev-mode-btn');
    const guidedContent = document.getElementById('guided-mode-content');
    const devContent = document.getElementById('dev-mode-content');

    async function openNodeModal(node?: { title: string; endpoint: string; type: string }) {
      if (!overlay) return;
      (overlay as HTMLElement).style.display = 'flex';
      setModalOpen(true);
      if (guidedModeBtn && devModeBtn && guidedContent && devContent) {
        guidedModeBtn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
        devModeBtn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
        guidedContent.classList.remove('hidden');
        devContent.classList.add('hidden');
      }
      // Update modal header
      const header = document.querySelector('#modal-header h2') as HTMLElement | null;
      if (header && node?.title) header.textContent = `Configure ${node.type} – ${node.title}`;
      // Fetch fields and hydrate schema
      const params = new URLSearchParams();
      if (node?.endpoint) params.set('endpoint', node.endpoint);
      if (node?.type) params.set('type', node.type.toLowerCase());
      const schema = getSchemaForEndpoint(node?.endpoint);
      // Apply preset immediately (fallback) and render fallback tokens if API unavailable
      const fallbackPreset: any = (schema?.guided || getPresetFor(node));
      requestAnimationFrame(() => {
        applyPresetToModal(fallbackPreset as any, node?.title);
        const pillsWrap = document.querySelector('#data-pills-section .flex.flex-wrap') as HTMLElement | null;
        if (pillsWrap && Array.isArray((fallbackPreset as any)?.fields)) {
          pillsWrap.innerHTML = '';
          ((fallbackPreset as any).fields as string[]).forEach((name) => {
            const span = document.createElement('span');
            span.className = 'pill-token px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform';
            span.textContent = `{{${name}}}`;
            span.addEventListener('click', () => {
              const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
              if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                const cursorPos = (active as any).selectionStart || 0;
                const before = (active as any).value.substring(0, cursorPos);
                const after = (active as any).value.substring((active as any).selectionEnd || cursorPos);
                (active as any).value = before + span.textContent + after;
                (active as any).setSelectionRange(before.length + (span.textContent||'').length, before.length + (span.textContent||'').length);
              }
            });
            pillsWrap.appendChild(span);
          });
        }
      });

      try {
        const getAuthHeaders = async () => {
          let token: string | null = null;
          // Supabase session if available
          try { if (supabase?.auth?.getSession) { const { data:{ session } } = await supabase.auth.getSession(); token = session?.access_token || null; } } catch {}
          // LocalStorage fallback (works with sb-*-auth-token)
          try {
            if (!token && typeof localStorage !== 'undefined') {
              const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
              if (key) { const raw = localStorage.getItem(key); if (raw) { const obj = JSON.parse(raw); token = obj?.access_token || obj?.accessToken || null; } }
            }
          } catch {}
          // Cookie fallback
          try {
            if (!token && typeof document !== 'undefined') {
              const m = document.cookie.match(/(?:^|; )sb-access-token=([^;]+)/);
              if (m) token = decodeURIComponent(m[1]);
            }
          } catch {}
          const h: Record<string,string> = { 'Accept': 'application/json' };
          if (token) { h['Authorization'] = `Bearer ${token}`; h['x-supabase-auth'] = `Bearer ${token}`; }
          return h;
        };
        const getApiBase = () => {
          try {
            const w: any = window as any;
            const flags = (w && w.__REX_FLAGS__) || {};
            const envUrl = (w && (w.VITE_BACKEND_URL || w.VITE_API_BASE_URL)) || '';
            const host = (typeof window !== 'undefined' && window.location ? window.location.origin : '');
            const isProd = host && host.indexOf('thehirepilot.com') > -1;
            const defaultBase = isProd ? 'https://api.thehirepilot.com' : 'http://localhost:8080';
            const apiBase = flags.apiBaseUrl || envUrl || defaultBase;
            return apiBase.endsWith('/api') ? apiBase : (apiBase + '/api');
          } catch { return '/api'; }
        };

        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
        const absUrl = origin ? `${origin}/api/workflows/fields${params.toString() ? `?${params.toString()}` : ''}` : `/api/workflows/fields${params.toString() ? `?${params.toString()}` : ''}`;

        // 1) Try same-origin Next API (Vercel)
        let resp = await fetch(absUrl, { headers: await getAuthHeaders(), credentials: 'include' });
        try { console.debug('[Sandbox] fields fetch 1 (vercel)', absUrl, 'status=', resp.status, 'ct=', resp.headers.get('content-type')); } catch {}

        // 2) If HTML/app-shell or non-200, try Railway backend base
        const isJson = resp.ok && String(resp.headers.get('content-type') || '').includes('application/json');
        if (!isJson) {
          const railway = getApiBase();
          const railUrl = `${railway.replace(/\/$/, '')}/workflows/fields${params.toString() ? `?${params.toString()}` : ''}`;
          // attach Supabase auth if present to avoid 401
          resp = await fetch(railUrl, { headers: await getAuthHeaders(), credentials: 'include' });
          try { console.debug('[Sandbox] fields fetch 2 (railway)', railUrl, 'status=', resp.status, 'ct=', resp.headers.get('content-type')); } catch {}
        }
        // 3) Last fallback to relative
        const finalIsJson = resp.ok && String(resp.headers.get('content-type') || '').includes('application/json');
        if (!finalIsJson) {
          const relUrl = `/api/workflows/fields${params.toString() ? `?${params.toString()}` : ''}`;
          resp = await fetch(relUrl, { headers: await getAuthHeaders(), credentials: 'include' });
          try { console.debug('[Sandbox] fields fetch 3 (relative)', relUrl, 'status=', resp.status, 'ct=', resp.headers.get('content-type')); } catch {}
        }
        if (!resp.ok) throw new Error('bad resp');
        const data = await resp.json().catch(async () => { try { console.debug('[Sandbox] fields non-JSON body', await resp.text()); } catch {}; return null; });
        requestAnimationFrame(() => {
          // rebuild pills deterministically using data-testid
          const pillsWrap = document.getElementById('pills-wrap') as HTMLElement | null;
          if (pillsWrap) {
            pillsWrap.innerHTML = '';
            (data?.fields || []).forEach((f: any) => {
              const name = typeof f === 'string' ? f : f?.name;
              const span = document.createElement('span');
              span.className = 'pill-token px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform';
              span.textContent = `{{${name}}}`;
              span.addEventListener('click', () => {
                const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                  const cursorPos = (active as any).selectionStart || 0;
                  const before = (active as any).value.substring(0, cursorPos);
                  const after = (active as any).value.substring((active as any).selectionEnd || cursorPos);
                  (active as any).value = before + span.textContent + after;
                  (active as any).setSelectionRange(before.length + (span.textContent||'').length, before.length + (span.textContent||'').length);
                }
              });
              pillsWrap.appendChild(span);
            });
          }
          // apply schema-guided defaults
          const preset = schema?.guided || getPresetFor(node);
          applyPresetToModal(preset as any, node?.title);
          setModalState({
            mode: 'guided',
            availableData: data?.fields || [],
            guidedDefaults: preset,
            developerDefaults: schema?.developer || null,
            preview: ''
          });
        });
      } catch {}
    }

    function closeModal() {
      if (overlay) (overlay as HTMLElement).style.display = 'none';
    }

    (document.getElementById('close-modal') as HTMLElement | null)?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    guidedModeBtn?.addEventListener('click', () => {
      guidedModeBtn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
      devModeBtn?.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
      guidedContent?.classList.remove('hidden');
      devContent?.classList.add('hidden');
    });
    devModeBtn?.addEventListener('click', () => {
      devModeBtn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
      guidedModeBtn?.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
      devContent?.classList.remove('hidden');
      guidedContent?.classList.add('hidden');
    });

    (document.getElementById('save-template-btn') as HTMLElement | null)?.addEventListener('click', async () => {
      // Collect a basic config from visible fields
      const nodeName = (document.querySelector('#config-fields input[type="text"]') as HTMLInputElement | null)?.value || 'Node';
      const body = { name: nodeName, mode: (devContent && !devContent.classList.contains('hidden')) ? 'developer' : 'guided', config: {} };
      await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }).catch(()=>{});
      try { (window as any).toast?.success?.('Template saved'); } catch {}
    });

    (document.getElementById('run-test-btn') as HTMLElement | null)?.addEventListener('click', async () => {
      const res = await fetch('/api/workflows/test_node', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: 'https://hooks.slack.com/services/...', method:'POST', headers:{'Content-Type':'application/json'}, body:{ ok:true } }) });
      alert(res.ok ? '✅ 200 OK' : '❌ Test failed');
    });

    return () => {
      sidebar.removeEventListener('dragstart', onDragStart as any);
      canvas.removeEventListener('dragover', onDragOver as any);
      canvas.removeEventListener('dragleave', onDragLeave as any);
      canvas.removeEventListener('drop', onDrop as any);
      (document.getElementById('close-modal') as HTMLElement | null)?.removeEventListener('click', closeModal);
    };
  }, []);

  // Reset modal state when node id changes
  useEffect(() => {
    if (!selectedNode) return;
    // rehydrate by reopening with the node context
    // relies on earlier openNodeModal logic to fetch and apply
    // For safety, ensure overlay is visible
    const overlay = document.getElementById('modal-overlay') as HTMLElement | null;
    if (overlay && overlay.style.display !== 'flex') overlay.style.display = 'flex';
  }, [selectedNode?.id]);

  const collectGraph = () => {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return { nodes: [] } as any;
    const nodes = Array.from(canvas.querySelectorAll('.absolute.transform'))
      .map((el) => {
        const title = (el.querySelector('h3') as HTMLElement)?.textContent || '';
        const endpoint = (el.querySelector('.text-xs') as HTMLElement)?.textContent?.trim() || '';
        const type = (el.querySelector('p.text-xs')?.textContent || '').includes('Action') ? 'Action' : 'Trigger';
        const style = (el as HTMLElement).style || ({} as any);
        return { title, endpoint, type, left: style.left, top: style.top };
      });
    return { nodes } as any;
  };

  const handlePreviewJson = () => {
    const data = collectGraph();
    try { alert(JSON.stringify(data, null, 2)); } catch {}
  };

  const handleTestRun = async () => {
    try {
      const data = collectGraph();
      const trigger = (data.nodes || []).find((n: any) => n.type === 'Trigger');
      const action = (data.nodes || []).find((n: any) => n.type === 'Action');
      const res = await fetch('/api/workflows/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_endpoint: trigger?.endpoint, action_endpoint: action?.endpoint }),
      });
      if (res.ok) alert('Test completed successfully'); else alert('Test failed');
    } catch (e) {
      alert('Test failed');
    }
  };

  const handleActivate = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('workflowId');
      if (!id) {
        alert('No workflowId provided. Save or open a workflow first.');
        return;
      }
      const res = await fetch('/api/workflows/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: true }),
      });
      if (res.ok) alert('Workflow activated'); else alert('Failed to activate');
    } catch (e) {
      alert('Failed to activate');
    }
  };

  return (
    <>
      <div id="sandbox-container" className="flex h-screen text-white">
        {/* Left Sidebar */}
        <div id="sidebar" className="w-72 bg-gray-900 border-r border-gray-800 p-4 flex flex-col overflow-y-auto">
          {/* Triggers Section */}
          <div id="triggers-section" className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-blue-400 flex items-center gap-2">
              <i className="fa-solid fa-bolt"></i>
              Triggers
            </h2>
            <div className="space-y-2">
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">👤</span>
                <div>
                  <div className="font-medium">Lead Created</div>
                  <div className="text-xs text-gray-400">/api/events/lead_created</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">🎉</span>
                <div>
                  <div className="font-medium">Candidate Hired</div>
                  <div className="text-xs text-gray-400">/api/events/candidate_hired</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">🚀</span>
                <div>
                  <div className="font-medium">Campaign Relaunched</div>
                  <div className="text-xs text-gray-400">/api/events/campaign_relaunched</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">🏷️</span>
                <div>
                  <div className="font-medium">Lead Tagged</div>
                  <div className="text-xs text-gray-400">/api/events/lead_tagged</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">🔗</span>
                <div>
                  <div className="font-medium">Lead Source Detected</div>
                  <div className="text-xs text-gray-400">/api/events/lead_source_triggered</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">📝</span>
                <div>
                  <div className="font-medium">Candidate Updated</div>
                  <div className="text-xs text-gray-400">/api/events/candidate_updated</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">🔄</span>
                <div>
                  <div className="font-medium">Pipeline Stage Changed</div>
                  <div className="text-xs text-gray-400">/api/events/pipeline_stage_updated</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">🏢</span>
                <div>
                  <div className="font-medium">Client Created</div>
                  <div className="text-xs text-gray-400">/api/events/client_created</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">♻️</span>
                <div>
                  <div className="font-medium">Client Updated</div>
                  <div className="text-xs text-gray-400">/api/events/client_updated</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">📄</span>
                <div>
                  <div className="font-medium">Job Req Created</div>
                  <div className="text-xs text-gray-400">/api/events/job_created</div>
                </div>
              </div>
              <div className="trigger-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow border border-gray-700 hover:border-blue-500/50" draggable>
                <span className="text-blue-400 text-lg">🌐</span>
                <div>
                  <div className="font-medium">Universal Event Feed</div>
                  <div className="text-xs text-gray-400">/api/zapier/triggers/events</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div id="actions-section">
            <h2 className="text-lg font-semibold mb-3 text-purple-400 flex items-center gap-2">
              <i className="fa-solid fa-cog"></i>
              Actions
            </h2>
            <div className="space-y-2">
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">📈</span>
                <div>
                  <div className="font-medium">Submit to Client</div>
                  <div className="text-xs text-gray-400">/api/actions/submit_to_client</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">💬</span>
                <div>
                  <div className="font-medium">Send Bulk Message</div>
                  <div className="text-xs text-gray-400">/api/actions/bulk_schedule</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">✉️</span>
                <div>
                  <div className="font-medium">Send Email Template</div>
                  <div className="text-xs text-gray-400">/api/actions/send_email_template</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">🔔</span>
                <div>
                  <div className="font-medium">Send Slack Notification</div>
                  <div className="text-xs text-gray-400">/api/actions/notifications</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">🧠</span>
                <div>
                  <div className="font-medium">Sync Enrichment</div>
                  <div className="text-xs text-gray-400">/api/actions/sync_enrichment</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">🤝</span>
                <div>
                  <div className="font-medium">Create Client</div>
                  <div className="text-xs text-gray-400">/api/actions/create_client</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">🧾</span>
                <div>
                  <div className="font-medium">Create Invoice</div>
                  <div className="text-xs text-gray-400">/api/actions/invoices_create</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">📝</span>
                <div>
                  <div className="font-medium">Add Deal Note</div>
                  <div className="text-xs text-gray-400">/api/actions/add_note</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">👥</span>
                <div>
                  <div className="font-medium">Add Collaborator</div>
                  <div className="text-xs text-gray-400">/api/actions/add_collaborator</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">➡️</span>
                <div>
                  <div className="font-medium">Update Pipeline Stage</div>
                  <div className="text-xs text-gray-400">/api/actions/update_pipeline_stage</div>
                </div>
              </div>
              <div className="action-node bg-gray-800 hover:bg-gray-700 cursor-grab p-3 rounded-lg flex items-center gap-3 text-sm transition-all duration-200 hover:node-glow-purple border border-gray-700 hover:border-purple-500/50" draggable>
                <span className="text-purple-400 text-lg">🤖</span>
                <div>
                  <div className="font-medium">Trigger REX Chat</div>
                  <div className="text-xs text-gray-400">/api/actions/rex_chat</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div id="main-canvas" className="flex-1 relative overflow-hidden">
          {/* Canvas Background */}
          <div id="canvas-background" className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 grid-pattern"></div>

          {/* Floating Hint */}
          <div id="canvas-hint" className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg text-xs text-gray-300 border border-gray-800 floating-animation">
            <i className="fa-solid fa-lightbulb text-yellow-400 mr-2"></i>
            Drag nodes from the sidebar to create your automation workflow
          </div>

          {/* Example Workflow Nodes */}
          <div id="workflow-node-1" className="absolute top-32 left-40 transform transition-all duration-200 hover:scale-105" style={{ cursor: 'move' }}>
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-xl shadow-lg border border-blue-400/20 w-64 node-glow">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="font-semibold text-white">Candidate Hired</h3>
                  <p className="text-xs text-blue-200">Trigger</p>
                </div>
              </div>
              <div className="text-xs text-blue-100 bg-blue-900/30 rounded-md px-2 py-1">/api/events/candidate_hired</div>
              <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-400 rounded-full border-2 border-white shadow-lg"></div>
            </div>
          </div>

          <div id="workflow-node-2" className="absolute top-32 left-96 transform transition-all duration-200 hover:scale-105" style={{ cursor: 'move' }}>
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl shadow-lg border border-purple-400/20 w-64 node-glow-purple">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">💬</span>
                <div>
                  <h3 className="font-semibold text-white">Send Slack Alert</h3>
                  <p className="text-xs text-purple-200">Action</p>
                </div>
              </div>
              <div className="text-xs text-purple-100 bg-purple-900/30 rounded-md px-2 py-1">/api/actions/slack_notification</div>
              <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-purple-400 rounded-full border-2 border-white shadow-lg"></div>
            </div>
          </div>

          {/* Connection Line */}
          <svg id="connection-svg" className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 as any }}>
            <defs>
              <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <path d="M 216 160 Q 280 160 320 160" stroke="url(#connectionGradient)" strokeWidth="3" fill="none" className="connection-line" />
          </svg>

          {/* Drop Zone Indicator */}
          <div id="drop-zone" className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300">
            <div className="absolute inset-4 border-2 border-dashed border-blue-400/50 rounded-xl bg-blue-400/5"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-400 text-lg font-medium">
              <i className="fa-solid fa-plus mr-2"></i>
              Drop node here to add to workflow
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div id="bottom-bar" className="absolute bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-sm border-t border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm flex items-center gap-2">
            <i className="fa-solid fa-info-circle"></i>
            Drag and connect triggers to actions to build your automation
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            REX Engine Connected
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePreviewJson} className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-code"></i>
            Preview JSON
          </button>
          <button onClick={handleTestRun} className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-play"></i>
            Test Run
          </button>
          <button onClick={handleActivate} className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-rocket"></i>
            Activate
          </button>
          <button onClick={() => {
            const canvas = document.getElementById('main-canvas');
            if (!canvas) return;
            Array.from(canvas.querySelectorAll(':scope > div.absolute.transform')).forEach((n) => n.remove());
            alert('Sandbox reset 🌪️');
          }} className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            🧹 Reset Sandbox
          </button>
        </div>
      </div>

      {/* Node Configuration Modal - exact markup adapted to JSX */}
      <div id="modal-overlay" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ display: 'none' }}>
        <div id="node-config-modal" className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div id="modal-header" className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-cogs text-white text-lg"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Configure Slack Alert Node</h2>
            </div>
            <button id="close-modal" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
              <i className="fas fa-times text-gray-500"></i>
            </button>
          </div>
          <div id="mode-toggle-section" className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Configuration Mode:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button id="guided-mode-btn" className="px-4 py-2 rounded-md text-sm font-medium transition-all bg-white shadow-sm text-blue-600">
                    <i className="fas fa-magic mr-2"></i>Guided
                  </button>
                  <button id="dev-mode-btn" className="px-4 py-2 rounded-md text-sm font-medium transition-all text-gray-600 hover:text-gray-900">
                    <i className="fas fa-code mr-2"></i>Developer
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button id="save-template-btn" className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  <i className="fas fa-bookmark mr-1"></i>Save Template
                </button>
              </div>
            </div>
          </div>
          <div id="modal-content" className="p-6 max-h-[60vh] overflow-y-auto">
            <div id="guided-mode-content" className="space-y-6">
              <div id="data-pills-section" className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <i className="fas fa-tags mr-2 text-blue-500"></i>Available Data
                </h3>
                <div id="pills-wrap" className="flex flex-wrap gap-2" data-testid="pills-container">
                  <span className="pill-token px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform">{"{{candidate.name}}"}</span>
                  <span className="pill-token px-3 py-1 bg-gradient-to-r from-green-500 to-teal-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform">{"{{job.title}}"}</span>
                  <span className="pill-token px-3 py-1 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform">{"{{candidate.email}}"}</span>
                  <span className="pill-token px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform">{"{{job.department}}"}</span>
                </div>
              </div>
              <div id="config-fields" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Node Name</label>
                    <input type="text" defaultValue="Slack Hire Alert" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Candidate Name</label>
                    <div className="relative">
                      <input type="text" defaultValue="{{candidate.name}}" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10" />
                      <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <i className="fas fa-chevron-down"></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                    <div className="relative">
                      <input type="text" defaultValue="{{job.title}}" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10" />
                      <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <i className="fas fa-chevron-down"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Slack Channel</label>
                    <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="#hiring-alerts">#hiring-alerts</option>
                      <option value="#general">#general</option>
                      <option value="#placements">#placements</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message Template</label>
                    <textarea rows={4} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="🎉 {{candidate.name}} hired for {{job.title}}!" defaultValue={"🎉 {{candidate.name}} hired for {{job.title}}!"}></textarea>
                  </div>
                </div>
              </div>
              <div id="sample-preview" className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <i className="fas fa-eye mr-2 text-green-500"></i>Live Preview
                </h3>
                <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                  <p className="text-sm text-gray-600">🎉 Sarah Johnson hired for Senior Frontend Developer!</p>
                </div>
              </div>
            </div>
            <div id="dev-mode-content" className="space-y-6 hidden">
              <div id="api-config" className="dev-mode-bg rounded-xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <i className="fas fa-terminal mr-2"></i>API Configuration
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Endpoint URL</label>
                    <input type="text" defaultValue="https://hooks.slack.com/services/..." className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Method</label>
                    <select className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white">
                      <option>POST</option>
                      <option>GET</option>
                      <option>PUT</option>
                      <option>DELETE</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Headers (JSON)</label>
                  <textarea rows={3} className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white font-mono text-sm" defaultValue='{"Content-Type": "application/json"}'></textarea>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Request Body (JSON)</label>
                  <textarea rows={8} className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-white font-mono text-sm" defaultValue={`{\n  "channel": "#hiring-alerts",\n  "text": "🎉 {{candidate.name}} hired for {{job.title}}!",\n  "username": "REX Hiring Bot",\n  "icon_emoji": ":tada:"\n}`}></textarea>
                </div>
              </div>
              <div id="test-section" className="bg-yellow-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                    <i className="fas fa-flask mr-2 text-yellow-500"></i>Test Configuration
                  </h3>
                  <button id="run-test-btn" className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">
                    <i className="fas fa-play mr-2"></i>Run Test
                  </button>
                </div>
                <p className="text-xs text-gray-600">Send a test request to validate your configuration</p>
              </div>
            </div>
          </div>
          <div id="modal-footer" className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
                <i className="fas fa-question-circle mr-2"></i>Help
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => { (document.getElementById('modal-overlay') as HTMLElement).style.display = 'none'; }}>
                Cancel
              </button>
              <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg">
                <i className="fas fa-save mr-2"></i>Save Node
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

