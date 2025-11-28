import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getSchemaForEndpoint, nodeSchemas } from '../config/nodeSchemas';

type SnapshotNode = {
  id?: string;
  title: string;
  endpoint: string;
  type: 'Trigger' | 'Action';
  left?: string;
  top?: string;
  icon?: string;
};

type SnapshotConnection = {
  id?: string;
  from?: string;
  to?: string;
};

type SpawnNodeConfig = {
  id?: string;
  title: string;
  endpoint: string;
  type: 'Trigger' | 'Action';
  icon?: string;
  left?: string;
  top?: string;
};

const SANDBOX_AUTOSAVE_KEY = 'hp_sandbox_graph_v1';

const readGraphFromDom = (): { nodes: SnapshotNode[]; connections: SnapshotConnection[] } => {
  const canvas = document.getElementById('main-canvas');
  const svg = document.getElementById('connection-svg');
  if (!canvas || !svg) return { nodes: [], connections: [] };

  const nodes = Array.from(canvas.querySelectorAll('.absolute.transform')).map((el) => {
    const nodeEl = el as HTMLElement;
    const title = (nodeEl.querySelector('h3') as HTMLElement)?.textContent || '';
    const endpoint = (nodeEl.querySelector('.text-xs') as HTMLElement)?.textContent?.trim() || '';
    const label = (nodeEl.querySelector('p.text-xs')?.textContent || '').includes('Action') ? 'Action' : 'Trigger';
    const nodeType = (nodeEl.dataset.nodeType as 'Trigger' | 'Action') || (label as 'Trigger' | 'Action');
    const icon = (nodeEl.querySelector('.text-2xl') as HTMLElement)?.textContent || '';
    const style = nodeEl.style || ({} as CSSStyleDeclaration);
    const left = style.left || `${nodeEl.offsetLeft || 0}px`;
    const top = style.top || `${nodeEl.offsetTop || 0}px`;
    const id = nodeEl.dataset.nodeId || '';
    return { id, title, endpoint, type: nodeType, left, top, icon };
  });

  const connections = Array.from(svg.querySelectorAll('path[data-connection-id]'))
    .map((path) => {
      const p = path as SVGPathElement;
      return {
        id: p.dataset.connectionId || '',
        from: p.dataset.fromNodeId || '',
        to: p.dataset.toNodeId || ''
      };
    })
    .filter((edge) => edge.from && edge.to);

  return { nodes, connections };
};

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
        const defaultSample = {
          candidate: { name: 'Sarah Johnson', email: 'sarah@example.com' },
          job: { title: 'Senior Frontend Developer', department: 'Engineering' },
          lead: { source: 'Apollo' },
          client: { name: 'Acme Inc.' },
          pipeline: { stage: 'Offer', prev_stage: 'Interview' }
        } as any;
        const sample = (preset && preset.sample) ? preset.sample : defaultSample;
        const rendered = String(preset.template || '')
          .replaceAll('{{candidate.name}}', sample?.candidate?.name || '')
          .replaceAll('{{job.title}}', sample?.job?.title || '')
          .replaceAll('{{job.department}}', sample?.job?.department || '')
          .replaceAll('{{lead.source}}', sample?.lead?.source || '')
          .replaceAll('{{client.name}}', sample?.client?.name || '')
          .replaceAll('{{pipeline.stage}}', sample?.pipeline?.stage || '');
        pv.textContent = rendered;
      }
    };
    let isDragging = false as boolean;
    let draggedElement: HTMLElement | null = null;
    const dragOffset = { x: 0, y: 0 } as { x: number; y: number };

    const sidebar = document.getElementById('sidebar');
    const canvas = document.getElementById('main-canvas');
    const dropZone = document.getElementById('drop-zone') as HTMLElement | null;
    const connectionSvg = document.getElementById('connection-svg') as SVGSVGElement | null;

    if (!sidebar || !canvas || !connectionSvg) return;

    type ConnectionRecord = {
      id: string;
      from: HTMLElement;
      to: HTMLElement;
      path: SVGPathElement;
    };

    const connections: ConnectionRecord[] = [];
    let connectionCounter = 0;
    let persistTimer: number | undefined;
    let isRestoring = false;

    const schedulePersist = () => {
      if (isRestoring) return;
      if (typeof window === 'undefined') return;
      if (persistTimer) window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => {
        try {
          const snapshot = readGraphFromDom();
          localStorage.setItem(SANDBOX_AUTOSAVE_KEY, JSON.stringify(snapshot));
        } catch {}
      }, 150);
    };

    const clearConnectionPaths = () => {
      connections.splice(0, connections.length);
      Array.from(connectionSvg.querySelectorAll('path[data-connection-id]')).forEach((path) => path.remove());
    };

    const getHandleForNode = (nodeId: string, handleType: 'input' | 'output') => {
      if (!nodeId) return null;
      const nodeEl = canvas.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
      if (!nodeEl) return null;
      return nodeEl.querySelector(`[data-handle="${handleType}"]`) as HTMLElement | null;
    };

    const ensureNodeIdentity = (node: HTMLElement | null) => {
      if (!node) return;
      if (!node.dataset.nodeId) node.dataset.nodeId = `node-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      if (!node.dataset.nodeType) {
        const fallback = (node.querySelector('p.text-xs')?.textContent || '').includes('Action') ? 'Action' : 'Trigger';
        node.dataset.nodeType = fallback;
      }
    };

    const getHandleCenter = (handle: HTMLElement) => {
      const rect = handle.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return {
        x: rect.left - canvasRect.left + rect.width / 2,
        y: rect.top - canvasRect.top + rect.height / 2
      };
    };

    const buildPathD = (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const dx = Math.max(Math.abs(end.x - start.x) * 0.5, 40);
      const c1x = start.x + dx;
      const c2x = end.x - dx;
      return `M ${start.x} ${start.y} C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`;
    };

    const createPathElement = (isPreview = false) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke', 'url(#connectionGradient)');
      path.setAttribute('stroke-width', isPreview ? '2' : '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.classList.add('connection-line');
      if (isPreview) {
        path.setAttribute('stroke-dasharray', '6 6');
        path.setAttribute('opacity', '0.65');
      } else {
        path.setAttribute('filter', 'url(#connectionGlow)');
      }
      return path;
    };

    const resolveInputHandle = (target: EventTarget | null): HTMLElement | null => {
      const el = target as HTMLElement | null;
      if (!el) return null;
      if (el.dataset.handle === 'input') return el;
      const direct = el.closest('[data-handle="input"]') as HTMLElement | null;
      if (direct) return direct;
      const actionNode = el.closest('[data-node-type="Action"]') as HTMLElement | null;
      if (actionNode) return actionNode.querySelector('[data-handle="input"]') as HTMLElement | null;
      return null;
    };

    const highlightActionTargets = (active: boolean) => {
      const actions = Array.from(canvas.querySelectorAll('[data-node-type="Action"]')) as HTMLElement[];
      actions.forEach((node) => {
        if (active) {
          node.dataset.prevShadow = node.style.boxShadow || '';
          node.style.boxShadow = `${node.dataset.prevShadow ? `${node.dataset.prevShadow},` : ''}0 0 0 4px rgba(250,204,21,0.35)`;
        } else if (node.dataset.prevShadow !== undefined) {
          node.style.boxShadow = node.dataset.prevShadow;
          delete node.dataset.prevShadow;
        }
      });
    };

    const pruneConnections = () => {
      for (let i = connections.length - 1; i >= 0; i -= 1) {
        const conn = connections[i];
        if (!document.body.contains(conn.from) || !document.body.contains(conn.to)) {
          conn.path.remove();
          connections.splice(i, 1);
        }
      }
    };

    const refreshConnectionLines = () => {
      pruneConnections();
      connections.forEach((conn) => {
        const start = getHandleCenter(conn.from);
        const end = getHandleCenter(conn.to);
        conn.path.setAttribute('d', buildPathD(start, end));
      });
    };

    const createConnection = (fromHandle: HTMLElement, toHandle: HTMLElement) => {
      const startNode = fromHandle.closest('[data-node-type]') as HTMLElement | null;
      const endNode = toHandle.closest('[data-node-type]') as HTMLElement | null;
      ensureNodeIdentity(startNode);
      ensureNodeIdentity(endNode);
      const fromType = startNode?.dataset.nodeType;
      const toType = endNode?.dataset.nodeType;
      const fromNodeId = startNode?.dataset.nodeId || '';
      const toNodeId = endNode?.dataset.nodeId || '';
      if (fromType === 'Action' || toType === 'Trigger' || !fromType || !toType) return;
      if (!fromNodeId || !toNodeId) return;

      const alreadyExists = connections.some((conn) => conn.from === fromHandle && conn.to === toHandle);
      if (alreadyExists) return;

      const path = createPathElement();
      const id = `conn-${connectionCounter++}`;
      path.dataset.connectionId = id;
      path.dataset.fromNodeId = fromNodeId;
      path.dataset.toNodeId = toNodeId;
      connectionSvg.appendChild(path);
      connections.push({ id, from: fromHandle, to: toHandle, path });
      refreshConnectionLines();
      schedulePersist();
    };

    const startConnectionDrag = (event: MouseEvent, startHandle: HTMLElement) => {
      event.stopPropagation();
      event.preventDefault();
      const preview = createPathElement(true);
      connectionSvg.appendChild(preview);
      highlightActionTargets(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const start = getHandleCenter(startHandle);
        const canvasRect = canvas.getBoundingClientRect();
        const end = {
          x: moveEvent.clientX - canvasRect.left,
          y: moveEvent.clientY - canvasRect.top
        };
        preview.setAttribute('d', buildPathD(start, end));
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        preview.remove();
        highlightActionTargets(false);
        const dropHandle = resolveInputHandle(upEvent.target);
        if (dropHandle) createConnection(startHandle, dropHandle);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const registerConnectionHandles = (node: HTMLElement) => {
      if (node.dataset.connectionHandles === 'ready') return;
      node.dataset.connectionHandles = 'ready';
      const handles = Array.from(node.querySelectorAll('[data-handle]')) as HTMLElement[];
      handles.forEach((handle) => {
        handle.dataset.nodeId = node.dataset.nodeId || '';
        handle.dataset.nodeType = node.dataset.nodeType || '';
        handle.classList.add('cursor-crosshair', 'ring-offset-1', 'ring-transparent', 'hover:ring-white/80');
        if (handle.dataset.handle === 'output') {
          handle.addEventListener('mousedown', (event) => startConnectionDrag(event, handle));
        } else {
          handle.addEventListener('mousedown', (event) => event.stopPropagation());
        }
      });
    };

    const refreshHandler = () => refreshConnectionLines();
    window.addEventListener('resize', refreshHandler);
    window.addEventListener('hp-refresh-connections', refreshHandler as EventListener);

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

    const showSlackConnectHint = (message?: string) => {
      const hint = document.getElementById('slack-channel-hint') as HTMLElement | null;
      const textTarget = hint?.querySelector('[data-role="slack-hint-text"]') as HTMLElement | null;
      if (hint) {
        if (message && textTarget) textTarget.textContent = message;
        hint.classList.remove('hidden');
      }
    };

    const hideSlackConnectHint = () => {
      const hint = document.getElementById('slack-channel-hint') as HTMLElement | null;
      hint?.classList.add('hidden');
    };

    const attachSlackConnectCta = () => {
      const btn = document.getElementById('slack-connect-cta') as HTMLButtonElement | null;
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
          window.open('/settings/integrations', '_blank', 'noopener');
        });
      }
    };

    const hydrateSlackChannels = async () => {
      const select = document.getElementById('slack-channel-select') as HTMLSelectElement | null;
      attachSlackConnectCta();
      if (!select) return;
      hideSlackConnectHint();
      select.innerHTML = '';
      const loadingOpt = document.createElement('option');
      loadingOpt.value = '';
      loadingOpt.textContent = 'Loading channels…';
      select.appendChild(loadingOpt);

      let token = '';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || '';
      } catch {}

      if (!token) {
        select.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Connect Slack to continue';
        select.appendChild(opt);
        showSlackConnectHint('Connect your Slack workspace to load channels.');
        return;
      }

      const envBase = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_BACKEND_URL) || '';
      const windowBase = (typeof window !== 'undefined' && (window as any)?.VITE_BACKEND_URL) || '';
      const apiFallback = 'https://api.thehirepilot.com';
      const baseCandidates = Array.from(new Set([envBase, windowBase, '', apiFallback])).filter((v) => typeof v === 'string') as string[];

      let hydrated = false;
      for (const base of baseCandidates) {
        const normalized = base ? base.replace(/\/$/, '') : '';
        const url = normalized ? `${normalized}/api/slack/channels` : '/api/slack/channels';
        try {
          const resp = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json'
            },
            credentials: 'include'
          });
          if (resp.status === 401 || resp.status === 403) {
            showSlackConnectHint('Connect Slack from Settings → Integrations to populate your channels.');
            break;
          }
          if (!resp.ok) continue;
          const payload = await resp.json().catch(() => null);
          const channels = Array.isArray(payload?.channels) ? payload.channels : [];
          if (channels.length > 0) {
            select.innerHTML = '';
            channels.slice(0, 200).forEach((channel: any) => {
              const opt = document.createElement('option');
              opt.value = channel.id || channel.value || channel.name;
              opt.textContent = channel.name ? `#${channel.name}` : (channel.label || 'Channel');
              select.appendChild(opt);
            });
            hydrated = true;
            hideSlackConnectHint();
            break;
          }
        } catch {
          continue;
        }
      }

      if (!hydrated) {
        select.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No channels found';
        select.appendChild(opt);
        showSlackConnectHint('Connect Slack or refresh the integration to pull channels.');
      }
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
      ensureNodeIdentity(node);
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const x = e.clientX - canvasRect.left - dragOffset.x;
          const y = e.clientY - canvasRect.top - dragOffset.y;
          node.style.left = Math.max(0, Math.min(x, canvasRect.width - 256)) + 'px';
          node.style.top = Math.max(0, Math.min(y, canvasRect.height - 100)) + 'px';
          refreshConnectionLines();
        }
      };
      const handleMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        schedulePersist();
      };
      node.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement)?.dataset?.handle) return;
        isDragging = true;
        const rect = node.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });
      makeNodeClickable(node);
      registerConnectionHandles(node);
    };

    const spawnWorkflowNode = (config: SpawnNodeConfig) => {
      if (!canvas) return null;
      const isAction = config.type === 'Action';
      const workflowNode = document.createElement('div');
      workflowNode.className = 'absolute transform transition-all duration-200 hover:scale-105';
      workflowNode.style.left = config.left || '0px';
      workflowNode.style.top = config.top || '0px';
      workflowNode.style.cursor = 'move';
      workflowNode.dataset.nodeType = config.type;
      workflowNode.dataset.nodeId = config.id || `node-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const icon = config.icon || (isAction ? '🤖' : '⚡');
      workflowNode.innerHTML = `
            <div class="bg-gradient-to-br ${isAction ? 'from-purple-600 to-purple-800' : 'from-blue-600 to-blue-800'} p-4 rounded-xl shadow-lg border ${isAction ? 'border-purple-400/20 node-glow-purple' : 'border-blue-400/20 node-glow'} w-64">
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-2xl">${icon}</span>
                    <div>
                        <h3 class="font-semibold text-white">${config.title}</h3>
                        <p class="text-xs ${isAction ? 'text-purple-200' : 'text-blue-200'}">${isAction ? 'Action' : 'Trigger'}</p>
                    </div>
                </div>
                <div class="text-xs ${isAction ? 'text-purple-100 bg-purple-900/30' : 'text-blue-100 bg-blue-900/30'} rounded-md px-2 py-1">
                    ${config.endpoint}
                </div>
                <div class="absolute ${isAction ? '-left-2' : '-right-2'} top-1/2 transform -translate-y-1/2 w-4 h-4 ${isAction ? 'bg-purple-400' : 'bg-blue-400'} rounded-full border-2 border-white shadow-lg" data-handle="${isAction ? 'input' : 'output'}"></div>
            </div>
        `;
      canvas.appendChild(workflowNode);
      makeNodeDraggable(workflowNode);
      refreshConnectionLines();
      schedulePersist();
      return workflowNode;
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
      spawnWorkflowNode({
        title: nodeData.title,
        endpoint: nodeData.endpoint,
        icon: nodeData.icon,
        type: isAction ? 'Action' : 'Trigger',
        left: x - 128 + 'px',
        top: y - 50 + 'px'
      });
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

    const restoreFromAutosave = () => {
      if (typeof window === 'undefined') return false;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(SANDBOX_AUTOSAVE_KEY);
      } catch {
        raw = null;
      }
      if (!raw) return false;
      let snapshot: { nodes?: SnapshotNode[]; connections?: SnapshotConnection[]; edges?: SnapshotConnection[] } | null = null;
      try {
        snapshot = JSON.parse(raw);
      } catch {
        snapshot = null;
      }
      if (!snapshot || !Array.isArray(snapshot.nodes) || snapshot.nodes.length === 0) return false;
      isRestoring = true;
      Array.from(canvas.querySelectorAll(':scope > div.absolute.transform')).forEach((node) => node.remove());
      clearConnectionPaths();
      snapshot.nodes.forEach((node) => {
        spawnWorkflowNode({
          id: node.id,
          title: node.title,
          endpoint: node.endpoint,
          icon: node.icon,
          type: node.type,
          left: node.left,
          top: node.top
        });
      });
      requestAnimationFrame(() => {
        const edges = snapshot?.connections || snapshot?.edges || [];
        edges.forEach((edge) => {
          const fromHandle = getHandleForNode(edge.from || '', 'output');
          const toHandle = getHandleForNode(edge.to || '', 'input');
          if (fromHandle && toHandle) createConnection(fromHandle, toHandle);
        });
        isRestoring = false;
        schedulePersist();
        refreshConnectionLines();
      });
      return true;
    };

    // Make existing nodes draggable and clickable on mount
    document.querySelectorAll('[id^="workflow-node-"]').forEach((n) => makeNodeDraggable(n as HTMLElement));
    const restored = restoreFromAutosave();
    if (!restored) {
      requestAnimationFrame(() => {
        const defaultTriggerHandle = document.querySelector('#workflow-node-1 [data-handle="output"]') as HTMLElement | null;
        const defaultActionHandle = document.querySelector('#workflow-node-2 [data-handle="input"]') as HTMLElement | null;
        if (defaultTriggerHandle && defaultActionHandle) {
          createConnection(defaultTriggerHandle, defaultActionHandle);
        }
      });
    }

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
      // Send slug (not full path) to backend to avoid route mismatches
      const toSlug = (ep: string, type: string) => {
        const s = String(ep || '').trim();
        if (s.startsWith('/api/events/')) return s.replace('/api/events/', '');
        if (s.startsWith('/api/actions/')) return s.replace('/api/actions/', '');
        const bySlash = s.split('/').filter(Boolean);
        return bySlash.length ? bySlash[bySlash.length - 1] : inferSlugFromTitle(node?.title || '');
      };
      if (node?.endpoint) params.set('endpoint', toSlug(node.endpoint, node?.type || ''));
      if (node?.type) params.set('type', node.type.toLowerCase());
      const schema = getSchemaForEndpoint(node?.endpoint);
      // Apply preset immediately (fallback) and render fallback tokens if API unavailable
      const fallbackPreset: any = (schema?.guided || getPresetFor(node));
      requestAnimationFrame(() => {
        applyPresetToModal(fallbackPreset as any, node?.title);
        const pillsWrap = document.getElementById('pills-wrap') as HTMLElement | null;
        const getTargetField = (): HTMLInputElement | HTMLTextAreaElement | null => {
          const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return active;
          const defText = document.querySelector('#config-fields textarea') as HTMLTextAreaElement | null;
          if (defText) return defText;
          const firstInput = document.querySelector('#config-fields input[type="text"]') as HTMLInputElement | null;
          return firstInput;
        };
        if (pillsWrap && Array.isArray((fallbackPreset as any)?.fields)) {
          pillsWrap.innerHTML = '';
          ((fallbackPreset as any).fields as string[]).forEach((name) => {
            const span = document.createElement('span');
            span.className = 'pill-token px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform';
            span.textContent = `{{${name}}}`;
            span.addEventListener('click', () => {
              const target = getTargetField();
              if (!target) return;
              const insert = span.textContent || '';
              const value = (target as any).value || '';
              const isFocused = document.activeElement === target;
              const startPos = isFocused ? ((target as any).selectionStart || value.length) : value.length;
              const endPos = isFocused ? ((target as any).selectionEnd || startPos) : startPos;
              const before = value.substring(0, startPos);
              const after = value.substring(endPos);
              (target as any).value = before + insert + after;
              try { (target as any).focus(); (target as any).setSelectionRange(before.length + insert.length, before.length + insert.length); } catch {}
            });
            pillsWrap.appendChild(span);
          });
        }
      });

      try {
        const getAuthHeaders = async (): Promise<Record<string, string>> => {
          try {
            if (supabase?.auth?.getSession) {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              const h: Record<string, string> = { Accept: 'application/json' };
              if (token) h['Authorization'] = `Bearer ${token}`;
              // Optional service/API key support per docs (X-API-Key)
              try {
                const w: any = window as any;
                const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env && ((import.meta as any).env.VITE_HP_API_KEY || (import.meta as any).env.VITE_FIELDS_SERVICE_KEY))
                  || w.__HP_API_KEY__ || w.__HP_SERVICE_KEY__ || w.HP_API_KEY;
                if (apiKey) h['X-API-Key'] = String(apiKey);
              } catch {}
              return h;
            }
          } catch {}
          return { Accept: 'application/json' } as Record<string, string>;
        };

        await hydrateSlackChannels();
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

        // Prefer canonical fields route first
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
        const proxyBase = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_FIELDS_PROXY_BASE) || origin;
        // Try canonical route
        let proxyUrl = `${proxyBase}/api/fields${params.toString() ? `?${params.toString()}` : ''}`;
        let resp = await fetch(proxyUrl, { headers: await getAuthHeaders(), credentials: 'include' });
        let ct = String(resp.headers.get('content-type') || '');
        try { console.debug('[Sandbox] fields fetch (canonical)', proxyUrl, 'status=', resp.status, 'ct=', ct); } catch {}
        // If the response is HTML (likely hitting SPA instead of API), try fallback to same-path relative (in case of reverse proxy)
        if (ct.includes('text/html')) {
          const relUrl = `/api/fields${params.toString() ? `?${params.toString()}` : ''}`;
          resp = await fetch(relUrl, { headers: await getAuthHeaders(), credentials: 'include' });
          ct = String(resp.headers.get('content-type') || '');
          try { console.debug('[Sandbox] fields fetch (canonical-relative)', relUrl, 'status=', resp.status, 'ct=', ct); } catch {}
        }
        // If not OK/JSON, try legacy proxy (/api/workflows/fields) then direct Railway
        if (!resp.ok || !ct.includes('application/json')) {
          // Try legacy internal proxy first
          const legacyUrl = `${proxyBase}/api/workflows/fields${params.toString() ? `?${params.toString()}` : ''}`;
          let legacy = await fetch(legacyUrl, { headers: await getAuthHeaders(), credentials: 'include' });
          let legacyCt = String(legacy.headers.get('content-type') || '');
          if (!(legacy.ok && legacyCt.includes('application/json'))) {
            // Then try direct Railway candidates
            const envBase = ((typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_FIELDS_API_BASE) || 'https://api.thehirepilot.com');
            const base = envBase.replace(/\/$/, '');
            const qs = params.toString() ? `?${params.toString()}` : '';
            const candidates = [
              `${base}/api/fields${qs}`,
              `${base}/fields${qs}`,
              `${base}/api/workflows/fields${qs}`,
              `${base}/workflows/fields${qs}`,
              `${base}/api/events/fields${qs}`,
              `${base}/api/actions/fields${qs}`,
              `${base}/v1/fields${qs}`,
              `${base}/api/v1/fields${qs}`
            ];
            let okResp: Response | null = null;
            for (const url of candidates) {
              const r = await fetch(url, { headers: await getAuthHeaders(), credentials: 'include' });
              const rct = String(r.headers.get('content-type') || '');
              try { console.debug('[Sandbox] fields fetch (direct candidate)', url, 'status=', r.status, 'ct=', rct); } catch {}
              if (r.ok && rct.includes('application/json')) { okResp = r; break; }
            }
            if (!okResp) throw new Error('bad resp');
            resp = okResp;
          } else {
            resp = legacy;
          }
        }
        const data = await resp.json().catch(async () => { try { console.debug('[Sandbox] fields non-JSON body', await resp.text()); } catch {}; return null; });
        requestAnimationFrame(() => {
          // rebuild pills deterministically using data-testid
          const pillsWrap = document.getElementById('pills-wrap') as HTMLElement | null;
          if (pillsWrap) {
            const getTargetField = (): HTMLInputElement | HTMLTextAreaElement | null => {
              const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
              if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return active;
              const defText = document.querySelector('#config-fields textarea') as HTMLTextAreaElement | null;
              if (defText) return defText;
              const firstInput = document.querySelector('#config-fields input[type="text"]') as HTMLInputElement | null;
              return firstInput;
            };
            pillsWrap.innerHTML = '';
            (data?.fields || []).forEach((f: any) => {
              const name = typeof f === 'string' ? f : f?.name;
              const span = document.createElement('span');
              span.className = 'pill-token px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform';
              span.textContent = `{{${name}}}`;
              span.addEventListener('click', () => {
                const target = getTargetField();
                if (!target) return;
                const insert = span.textContent || '';
                const value = (target as any).value || '';
                const isFocused = document.activeElement === target;
                const startPos = isFocused ? ((target as any).selectionStart || value.length) : value.length;
                const endPos = isFocused ? ((target as any).selectionEnd || startPos) : startPos;
                const before = value.substring(0, startPos);
                const after = value.substring(endPos);
                (target as any).value = before + insert + after;
                try { (target as any).focus(); (target as any).setSelectionRange(before.length + insert.length, before.length + insert.length); } catch {}
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
      } catch {
        // Enhanced fallback: derive fields from Universal Events API if available (triggers)
        try {
          const envBase = ((typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_FIELDS_API_BASE) || 'https://api.thehirepilot.com');
          const base = envBase.replace(/\/$/, '');
          const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
          const toAuth = await (async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              const h: Record<string,string> = { Accept: 'application/json' };
              if (token) h['Authorization'] = `Bearer ${token}`;
              try {
                const w: any = window as any;
                const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env && ((import.meta as any).env.VITE_HP_API_KEY || (import.meta as any).env.VITE_FIELDS_SERVICE_KEY))
                  || w.__HP_API_KEY__ || w.__HP_SERVICE_KEY__ || w.HP_API_KEY;
                if (apiKey) h['X-API-Key'] = String(apiKey);
              } catch {}
              return h;
            } catch { return { Accept: 'application/json' } as Record<string,string>; }
          })();

          const slugFromEndpoint = (ep: string) => {
            const s = String(ep || '');
            if (s.includes('lead_created')) return 'lead_source_added';
            if (s.includes('lead_tagged')) return 'lead_tag_added';
            if (s.includes('campaign_relaunched')) return 'campaign_relaunched';
            if (s.includes('candidate_hired')) return 'opportunity_submitted';
            if (s.includes('pipeline_stage')) return 'pipeline_stage_updated';
            if (s.includes('client_updated')) return 'client_updated';
            if (s.includes('client_created')) return 'client_created';
            return inferSlugFromTitle(node?.title || '') || 'lead_source_added';
          };

          const tryTypes = Array.from(new Set([
            slugFromEndpoint(node?.endpoint || ''),
            'lead_source_added',
            'lead_tag_added',
            'campaign_relaunched',
            'opportunity_submitted'
          ]));

          let picked: any = null;
          for (const ev of tryTypes) {
            const url = `${base}/api/zapier/triggers/events?event_type=${encodeURIComponent(ev)}&since=${encodeURIComponent(since)}`;
            const r = await fetch(url, { headers: toAuth, credentials: 'include' });
            const ct = String(r.headers.get('content-type') || '');
            try { console.debug('[Sandbox] events fallback', ev, r.status, ct); } catch {}
            if (r.ok && ct.includes('application/json')) { picked = await r.json(); break; }
          }

          if (picked) {
            const first = Array.isArray(picked) ? picked[0] : (picked?.events?.[0] || picked);
            const payload = first?.payload || first?.data || {};
            const acc: string[] = [];
            const walk = (o: any, p: string[] = []) => {
              if (!o || typeof o !== 'object') return;
              for (const k of Object.keys(o)) {
                const v = o[k];
                const path = [...p, k];
                if (v && typeof v === 'object') walk(v, path);
                else acc.push(path.join('.'));
              }
            };
            walk(payload, []);
            requestAnimationFrame(() => {
              const pillsWrap = document.getElementById('pills-wrap') as HTMLElement | null;
              if (pillsWrap) {
                const getTargetField = (): HTMLInputElement | HTMLTextAreaElement | null => {
                  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
                  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return active;
                  const defText = document.querySelector('#config-fields textarea') as HTMLTextAreaElement | null;
                  if (defText) return defText;
                  const firstInput = document.querySelector('#config-fields input[type="text"]') as HTMLInputElement | null;
                  return firstInput;
                };
                pillsWrap.innerHTML = '';
                acc.slice(0, 50).forEach((name) => {
                  const span = document.createElement('span');
                  span.className = 'pill-token px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs rounded-full cursor-pointer hover:scale-105 transition-transform';
                  span.textContent = `{{${name}}}`;
                  span.addEventListener('click', () => {
                    const target = getTargetField();
                    if (!target) return;
                    const insert = span.textContent || '';
                    const value = (target as any).value || '';
                    const isFocused = document.activeElement === target;
                    const startPos = isFocused ? ((target as any).selectionStart || value.length) : value.length;
                    const endPos = isFocused ? ((target as any).selectionEnd || startPos) : startPos;
                    const before = value.substring(0, startPos);
                    const after = value.substring(endPos);
                    (target as any).value = before + insert + after;
                    try { (target as any).focus(); (target as any).setSelectionRange(before.length + insert.length, before.length + insert.length); } catch {}
                  });
                  pillsWrap.appendChild(span);
                });
              }
              const preset = getSchemaForEndpoint(node?.endpoint)?.guided || getPresetFor(node);
              applyPresetToModal(preset as any, node?.title);
              setModalState({
                mode: 'guided',
                availableData: acc,
                guidedDefaults: preset,
                developerDefaults: null,
                preview: ''
              });
            });
          }
        } catch {}
      }
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
      if (persistTimer) window.clearTimeout(persistTimer);
      window.removeEventListener('resize', refreshHandler);
      window.removeEventListener('hp-refresh-connections', refreshHandler as EventListener);
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

  const collectGraph = () => readGraphFromDom();

  const handlePreviewJson = () => {
    const data = collectGraph();
    try { alert(JSON.stringify(data, null, 2)); } catch {}
  };

  const handleTestRun = async () => {
    try {
      const data = collectGraph();
      const firstConnection = (data.connections || [])[0];
      const trigger = firstConnection
        ? (data.nodes || []).find((n: any) => n.id === firstConnection.from)
        : (data.nodes || []).find((n: any) => n.type === 'Trigger');
      const action = firstConnection
        ? (data.nodes || []).find((n: any) => n.id === firstConnection.to)
        : (data.nodes || []).find((n: any) => n.type === 'Action');
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
      if (res.ok) {
        try {
          // When activated, persist to My Workflows list used by /workflows (scoped per user)
          const titleEl = document.querySelector('#workflow-node-1 h3') as HTMLElement | null;
          const title = (titleEl?.textContent || 'Activated Workflow').trim();
          const description = 'Workflow activated from Sandbox';
          // Determine per-user storage key
          let key = 'hp_my_workflows_v1';
          try {
            const { data: { user } } = await supabase.auth.getUser();
            const uid = user?.id || 'anon';
            key = `hp_my_workflows_v2_${uid}`;
          } catch {}
          const stored = JSON.parse(localStorage.getItem(key) || '[]');
          const exists = Array.isArray(stored) && stored.some((w:any) => w.title === title);
          const wf = { id: Date.now(), title, description, tools: [], category: 'Custom' };
          const next = exists ? stored : [...stored, wf];
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        alert('Workflow activated');
      } else {
        alert('Failed to activate');
      }
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
          <div
            id="workflow-node-1"
            className="absolute top-32 left-40 transform transition-all duration-200 hover:scale-105"
            style={{ cursor: 'move' }}
            data-node-type="Trigger"
          >
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-xl shadow-lg border border-blue-400/20 w-64 node-glow">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <h3 className="font-semibold text-white">Candidate Hired</h3>
                  <p className="text-xs text-blue-200">Trigger</p>
                </div>
              </div>
              <div className="text-xs text-blue-100 bg-blue-900/30 rounded-md px-2 py-1">/api/events/candidate_hired</div>
              <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-400 rounded-full border-2 border-white shadow-lg" data-handle="output"></div>
            </div>
      </div>

          <div
            id="workflow-node-2"
            className="absolute top-32 left-96 transform transition-all duration-200 hover:scale-105"
            style={{ cursor: 'move' }}
            data-node-type="Action"
          >
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl shadow-lg border border-purple-400/20 w-64 node-glow-purple">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">💬</span>
                <div>
                  <h3 className="font-semibold text-white">Send Slack Alert</h3>
                  <p className="text-xs text-purple-200">Action</p>
                </div>
              </div>
              <div className="text-xs text-purple-100 bg-purple-900/30 rounded-md px-2 py-1">/api/actions/slack_notification</div>
              <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 bg-purple-400 rounded-full border-2 border-white shadow-lg" data-handle="input"></div>
            </div>
      </div>

          {/* Connection Line */}
          <svg id="connection-svg" className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 as any }}>
            <defs>
              <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
              </linearGradient>
              <filter id="connectionGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#60a5fa" floodOpacity="0.45" />
              </filter>
            </defs>
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
            const svg = document.getElementById('connection-svg') as SVGSVGElement | null;
            if (svg) {
              Array.from(svg.querySelectorAll('path[data-connection-id]')).forEach((n) => n.remove());
            }
            try { localStorage.removeItem(SANDBOX_AUTOSAVE_KEY); } catch {}
            window.dispatchEvent(new CustomEvent('hp-refresh-connections'));
            alert('Sandbox reset 🌪️');
          }} className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            🧹 Reset Sandbox
          </button>
        </div>
      </div>

      {/* Node Configuration Modal - exact markup adapted to JSX */}
      <div id="modal-overlay" className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50" style={{ display: 'none' }}>
        <div id="node-config-modal" className="bg-white dark:bg-[#0f1218] dark:text-gray-100 rounded-2xl shadow-2xl border border-gray-100/40 dark:border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div id="modal-header" className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <i className="fas fa-cogs text-white text-lg"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configure Slack Alert Node</h2>
            </div>
            <button id="close-modal" className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors">
              <i className="fas fa-times text-gray-500 dark:text-gray-400"></i>
            </button>
          </div>
          <div id="mode-toggle-section" className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Configuration Mode:</span>
                <div className="flex bg-gray-100 dark:bg-gray-800/70 rounded-lg p-1">
                  <button id="guided-mode-btn" className="px-4 py-2 rounded-md text-sm font-medium transition-all bg-white dark:bg-gray-900 shadow-sm text-blue-600 dark:text-blue-400">
                    <i className="fas fa-magic mr-2"></i>Guided
                  </button>
                  <button id="dev-mode-btn" className="px-4 py-2 rounded-md text-sm font-medium transition-all text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                    <i className="fas fa-code mr-2"></i>Developer
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button id="save-template-btn" className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <i className="fas fa-bookmark mr-1"></i>Save Template
                </button>
              </div>
            </div>
          </div>
          <div id="modal-content" className="p-6 max-h-[60vh] overflow-y-auto bg-white dark:bg-transparent">
            <div id="guided-mode-content" className="space-y-6">
              <div id="data-pills-section" className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/40 dark:to-purple-950/40 rounded-xl p-4 border border-transparent dark:border-white/5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center">
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Node Name</label>
                    <input type="text" defaultValue="Slack Hire Alert" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Candidate Name</label>
                    <div className="relative">
                      <input type="text" defaultValue="{{candidate.name}}" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 dark:bg-gray-800 dark:text-gray-100" />
                      <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <i className="fas fa-chevron-down"></i>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title</label>
                    <div className="relative">
                      <input type="text" defaultValue="{{job.title}}" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 dark:bg-gray-800 dark:text-gray-100" />
                      <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <i className="fas fa-chevron-down"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Slack Channel</label>
                    <select id="slack-channel-select" className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100">
                      <option value="">Loading channels…</option>
                    </select>
                    <div id="slack-channel-hint" className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 hidden">
                      <span data-role="slack-hint-text">Connect Slack to load your channels.</span>
                      <button
                        type="button"
                        id="slack-connect-cta"
                        className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                      >
                        Connect Slack
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message Template</label>
                    <textarea rows={4} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100" placeholder="🎉 {{candidate.name}} hired for {{job.title}}!" defaultValue={"🎉 {{candidate.name}} hired for {{job.title}}!"}></textarea>
                  </div>
                </div>
              </div>
              <div id="sample-preview" className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center">
                  <i className="fas fa-eye mr-2 text-green-500"></i>Live Preview
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
                  <p className="text-sm text-gray-600 dark:text-gray-200">🎉 Sarah Johnson hired for Senior Frontend Developer!</p>
                </div>
              </div>
            </div>
            <div id="dev-mode-content" className="space-y-6 hidden">
              <div id="api-config" className="dev-mode-bg bg-gray-900/90 dark:bg-gray-900 rounded-xl p-6 text-gray-900 dark:text-white">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <i className="fas fa-terminal mr-2"></i>API Configuration
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Endpoint URL</label>
                    <input type="text" defaultValue="https://hooks.slack.com/services/..." className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Method</label>
                    <select className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white">
                      <option>POST</option>
                      <option>GET</option>
                      <option>PUT</option>
                      <option>DELETE</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Headers (JSON)</label>
                  <textarea rows={3} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white font-mono text-sm" defaultValue='{"Content-Type": "application/json"}'></textarea>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Request Body (JSON)</label>
                  <textarea rows={8} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white font-mono text-sm" defaultValue={`{\n  "channel": "#hiring-alerts",\n  "text": "🎉 {{candidate.name}} hired for {{job.title}}!",\n  "username": "REX Hiring Bot",\n  "icon_emoji": ":tada:"\n}`}></textarea>
                </div>
              </div>
              <div id="test-section" className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center">
                    <i className="fas fa-flask mr-2 text-yellow-500"></i>Test Configuration
                  </h3>
                  <button id="run-test-btn" className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">
                    <i className="fas fa-play mr-2"></i>Run Test
                  </button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300">Send a test request to validate your configuration</p>
              </div>
            </div>
          </div>
          <div id="modal-footer" className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0d12]">
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors">
                <i className="fas fa-question-circle mr-2"></i>Help
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <button className="px-6 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => { (document.getElementById('modal-overlay') as HTMLElement).style.display = 'none'; }}>
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

