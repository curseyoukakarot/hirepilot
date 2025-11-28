import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';

type NodeConfig = {
  title: string;
  endpoint: string;
  type: 'Trigger' | 'Action';
  slackChannel?: string;
};

type SlackChannel = {
  id?: string;
  name?: string;
  value?: string;
};

export default function SandboxPage() {
  const router = useRouter();
  const { workflowId } = router.query as { workflowId?: string };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeConfig | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionSummary, setConnectionSummary] = useState<string[]>([]);
  const [showConnectionPanel, setShowConnectionPanel] = useState(false);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [slackChannelValue, setSlackChannelValue] = useState('');
  const [slackHint, setSlackHint] = useState<string | null>(null);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);
  const activeOutputHandleRef = useRef<HTMLElement | null>(null);
  const potentialConnectionTargetRef = useRef<HTMLElement | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const selectedSlackChannelMeta = useMemo(
    () => slackChannels.find((channel) => (channel.id || channel.value || '') === slackChannelValue),
    [slackChannels, slackChannelValue]
  );

  useEffect(() => {
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
      fromTitle?: string;
      toTitle?: string;
    };

    const connections: ConnectionRecord[] = [];
    let connectionCounter = 0;
    let nodeIdentityCounter = 0;

    const ensureNodeIdentity = (node: HTMLElement | null) => {
      if (!node) return;
      if (!node.dataset.nodeId) node.dataset.nodeId = `node-${Date.now()}-${nodeIdentityCounter++}`;
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
        y: rect.top - canvasRect.top + rect.height / 2,
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

    const refreshConnectionSummary = () => {
      setConnectionSummary(connections.map((conn) => `${conn.fromTitle || 'Trigger'} → ${conn.toTitle || 'Action'}`));
    };

    const pruneConnections = () => {
      for (let i = connections.length - 1; i >= 0; i -= 1) {
        const conn = connections[i];
        if (!document.body.contains(conn.from) || !document.body.contains(conn.to)) {
          conn.path.remove();
          connections.splice(i, 1);
        }
      }
      refreshConnectionSummary();
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
      console.log('[Sandbox:Next] createConnection called', { fromHandle, toHandle });
      const startNode = fromHandle.closest('[data-node-type]') as HTMLElement | null;
      const endNode = toHandle.closest('[data-node-type]') as HTMLElement | null;
      ensureNodeIdentity(startNode);
      ensureNodeIdentity(endNode);
      const fromType = startNode?.dataset.nodeType;
      const toType = endNode?.dataset.nodeType;
      if (fromType === 'Action' || toType === 'Trigger' || !fromType || !toType) {
        console.warn('[Sandbox:Next] invalid connection types', { fromType, toType });
        return;
      }

      const alreadyExists = connections.some((conn) => conn.from === fromHandle && conn.to === toHandle);
      if (alreadyExists) {
        console.info('[Sandbox:Next] connection already exists');
        return;
      }

      const outputRect = fromHandle.getBoundingClientRect();
      const inputRect = toHandle.getBoundingClientRect();
      const svgRect = connectionSvg.getBoundingClientRect();

      console.log('[Sandbox:Next] outputRect', outputRect);
      console.log('[Sandbox:Next] inputRect', inputRect);
      console.log('[Sandbox:Next] svgRect', svgRect);

      const startX = outputRect.left + outputRect.width / 2 - svgRect.left;
      const startY = outputRect.top + outputRect.height / 2 - svgRect.top;
      const endX = inputRect.left + inputRect.width / 2 - svgRect.left;
      const endY = inputRect.top + inputRect.height / 2 - svgRect.top;

      console.log('[Sandbox:Next] calculated SVG coords', { startX, startY, endX, endY });

      if (!isFinite(startX) || !isFinite(startY) || !isFinite(endX) || !isFinite(endY)) {
        console.error('[Sandbox:Next] invalid coords, aborting connection render');
        return;
      }

      const pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
      const fromTitle = ((startNode?.querySelector('h3') as HTMLElement)?.textContent || '').trim() || 'Trigger';
      const toTitle = ((endNode?.querySelector('h3') as HTMLElement)?.textContent || '').trim() || 'Action';
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const id = `conn-${connectionCounter++}`;
      path.dataset.connectionId = id;
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', '#3b82f6');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.classList.add('connection-line', 'connection-debug-line');
      connectionSvg.appendChild(path);
      console.log('[Sandbox:Next] PATH APPENDED →', path);

      connections.push({ id, from: fromHandle, to: toHandle, path, fromTitle, toTitle });
      refreshConnectionSummary();
    };

    const setPotentialTarget = (node: HTMLElement | null) => {
      if (potentialConnectionTargetRef.current === node) return;
      if (potentialConnectionTargetRef.current) {
        const prev = potentialConnectionTargetRef.current.dataset.prevShadow || '';
        potentialConnectionTargetRef.current.style.boxShadow = prev;
        delete potentialConnectionTargetRef.current.dataset.prevShadow;
      }
      potentialConnectionTargetRef.current = node;
      if (node) {
        node.dataset.prevShadow = node.style.boxShadow || '';
        node.style.boxShadow = `${node.dataset.prevShadow ? `${node.dataset.prevShadow},` : ''}0 0 0 4px rgba(250,204,21,0.35)`;
      }
    };

    const registerHoverListeners = (node: HTMLElement) => {
      node.addEventListener('pointerenter', () => {
        if (!activeOutputHandleRef.current) return;
        if ((node.dataset.nodeType || '').toLowerCase() !== 'action') return;
        setPotentialTarget(node);
      });
      node.addEventListener('pointerleave', () => {
        if (!activeOutputHandleRef.current) return;
        if (potentialConnectionTargetRef.current === node) setPotentialTarget(null);
      });
    };

    const startConnectionDrag = (event: PointerEvent, startHandle: HTMLElement) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      activeOutputHandleRef.current = startHandle;
      const preview = createPathElement(true);
      connectionSvg.appendChild(preview);
      const previousPointerEvents = connectionSvg.style.pointerEvents;
      connectionSvg.style.pointerEvents = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const start = getHandleCenter(startHandle);
        const canvasRect = canvas.getBoundingClientRect();
        const end = {
          x: moveEvent.clientX - canvasRect.left,
          y: moveEvent.clientY - canvasRect.top,
        };
        preview.setAttribute('d', buildPathD(start, end));
      };

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        requestAnimationFrame(() => {
          preview.remove();
          connectionSvg.style.pointerEvents = previousPointerEvents;
          connectionSvg.getBoundingClientRect();
          const targetNode = potentialConnectionTargetRef.current;
          if (targetNode && activeOutputHandleRef.current) {
            const dropHandle = (targetNode.querySelector('[data-handle="input"]') as HTMLElement | null) || targetNode;
            createConnection(activeOutputHandleRef.current, dropHandle);
          }
          setPotentialTarget(null);
          activeOutputHandleRef.current = null;
        });
      };

      document.addEventListener('pointermove', handlePointerMove, { passive: true });
      document.addEventListener('pointerup', handlePointerUp, { passive: true });
    };

    const registerConnectionHandles = (node: HTMLElement) => {
      if (node.dataset.connectionHandles === 'ready') return;
      node.dataset.connectionHandles = 'ready';
      const handles = Array.from(node.querySelectorAll('[data-handle]')) as HTMLElement[];
      handles.forEach((handle) => {
        handle.dataset.nodeId = node.dataset.nodeId || '';
        handle.dataset.nodeType = node.dataset.nodeType || '';
        handle.classList.add('cursor-crosshair');
        if (handle.dataset.handle === 'output') {
          handle.addEventListener('pointerdown', (event) => startConnectionDrag(event as PointerEvent, handle), { passive: false });
        } else {
          handle.addEventListener('pointerdown', (event) => event.stopPropagation());
        }
      });
    };

    window.addEventListener('resize', refreshConnectionLines);

    let seedRaf: number | null = null;
    let seedTimeout: number | null = null;

    const cancelSeedConnection = () => {
      if (seedRaf) cancelAnimationFrame(seedRaf);
      if (seedTimeout) window.clearTimeout(seedTimeout);
    };

    const scheduleSeedConnection = () => {
      cancelSeedConnection();
      seedRaf = requestAnimationFrame(() => {
        seedTimeout = window.setTimeout(() => {
          const defaultTrigger = document.querySelector('#workflow-node-1 [data-handle="output"]') as HTMLElement | null;
          const defaultAction = document.querySelector('#workflow-node-2 [data-handle="input"]') as HTMLElement | null;
          if (defaultTrigger && defaultAction) createConnection(defaultTrigger, defaultAction);
        }, 150);
      });
    };

    // Handle drag start for sidebar items
    const onDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      if (target.classList.contains('trigger-node') || target.classList.contains('action-node')) {
        isDragging = true;
        draggedElement = target.cloneNode(true) as HTMLElement;
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

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (dropZone) dropZone.style.opacity = '0';
      if (draggedElement && canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || 0) - rect.left;
        const y = (e.clientY || 0) - rect.top;
        createWorkflowNode(draggedElement, x, y);
        draggedElement = null;
      }
    };

    const extractNodeData = (element: HTMLElement): NodeConfig => {
      const title = (element.querySelector('.font-medium') as HTMLElement)?.textContent || '';
      const endpoint = (element.querySelector('.text-xs.text-gray-400') as HTMLElement)?.textContent || '';
      const isAction = element.classList.contains('action-node');
      return { title, endpoint, type: isAction ? 'Action' : 'Trigger' };
    };

    const makeNodeDraggable = (node: HTMLElement) => {
      ensureNodeIdentity(node);
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const x = e.clientX - canvasRect.left - dragOffset.x;
          const y = e.clientY - canvasRect.top - dragOffset.y;
          const nx = Math.max(0, Math.min(x, canvasRect.width - 256));
          const ny = Math.max(0, Math.min(y, canvasRect.height - 100));
          node.style.left = nx + 'px';
          node.style.top = ny + 'px';
          refreshConnectionLines();
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
      // open modal on double click
      node.addEventListener('dblclick', () => {
        const title = (node.querySelector('h3') as HTMLElement)?.textContent || '';
        const endpoint = (node.querySelector('.text-xs') as HTMLElement)?.textContent?.trim() || '';
        const type = (node.querySelector('p.text-xs')?.textContent || '').includes('Action') ? 'Action' : 'Trigger';
        setSelectedNode({ title, endpoint, type });
        setIsModalOpen(true);
      });
      registerConnectionHandles(node);
      registerHoverListeners(node);
    };

    const createWorkflowNode = (sourceElement: HTMLElement, x: number, y: number) => {
      const isAction = sourceElement.classList.contains('action-node');
      const nodeData = extractNodeData(sourceElement);
      const workflowNode = document.createElement('div');
      workflowNode.className = 'absolute transform transition-all duration-200 hover:scale-105';
      workflowNode.style.left = x - 128 + 'px';
      workflowNode.style.top = y - 50 + 'px';
      (workflowNode.style as any).cursor = 'move';
      workflowNode.dataset.nodeType = isAction ? 'Action' : 'Trigger';
      workflowNode.innerHTML = `
            <div class="bg-gradient-to-br ${isAction ? 'from-purple-600 to-purple-800' : 'from-blue-600 to-blue-800'} p-4 rounded-xl shadow-lg border ${isAction ? 'border-purple-400/20 node-glow-purple' : 'border-blue-400/20 node-glow'} w-64">
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-2xl">${(sourceElement.querySelector('span') as HTMLElement)?.textContent || ''}</span>
                    <div>
                        <h3 class="font-semibold text-white">${nodeData.title}</h3>
                        <p class="text-xs ${isAction ? 'text-purple-200' : 'text-blue-200'}">${isAction ? 'Action' : 'Trigger'}</p>
                    </div>
                </div>
                <div class="text-xs ${isAction ? 'text-purple-100 bg-purple-900/30' : 'text-blue-100 bg-blue-900/30'} rounded-md px-2 py-1">
                    ${nodeData.endpoint}
                </div>
                <div class="absolute ${isAction ? '-left-2' : '-right-2'} top-1/2 transform -translate-y-1/2 w-4 h-4 ${isAction ? 'bg-purple-400' : 'bg-blue-400'} rounded-full border-2 border-white shadow-lg" data-handle="${isAction ? 'input' : 'output'}"></div>
            </div>
        `;
      canvas.appendChild(workflowNode);
      makeNodeDraggable(workflowNode);
    };

    const onDomContentLoaded = () => {
      document.querySelectorAll('[id^="workflow-node-"]').forEach((n) => makeNodeDraggable(n as HTMLElement));
      scheduleSeedConnection();
    };

    sidebar.addEventListener('dragstart', onDragStart as any);
    canvas.addEventListener('dragover', onDragOver as any);
    canvas.addEventListener('dragleave', onDragLeave as any);
    canvas.addEventListener('drop', onDrop as any);
    document.addEventListener('DOMContentLoaded', onDomContentLoaded);
    // In case DOMContentLoaded already fired in SPA
    onDomContentLoaded();

    return () => {
      cancelSeedConnection();
      setPotentialTarget(null);
      activeOutputHandleRef.current = null;
      setConnectionSummary([]);
      window.removeEventListener('resize', refreshConnectionLines);
      sidebar.removeEventListener('dragstart', onDragStart as any);
      canvas.removeEventListener('dragover', onDragOver as any);
      canvas.removeEventListener('dragleave', onDragLeave as any);
      canvas.removeEventListener('drop', onDrop as any);
      document.removeEventListener('DOMContentLoaded', onDomContentLoaded);
    };
  }, [setConnectionSummary]);

  const hydrateSlackChannels = useCallback(async () => {
    if (!supabase) {
      setSlackHint('Slack channels require a browser session. Refresh to try again.');
      setSlackChannels([]);
      return;
    }
    setSlackLoading(true);
    setSlackError(null);
    setSlackHint(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        setSlackHint('Connect Slack from Settings → Integrations to load channels.');
        setSlackChannels([]);
        return;
      }
      const response = await fetch('/api/slack/channels', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (response.status === 401 || response.status === 403) {
        setSlackHint('Connect Slack from Settings → Integrations to load channels.');
        setSlackChannels([]);
        return;
      }
      if (!response.ok) {
        throw new Error(`Slack channels request failed (${response.status})`);
      }
      const payload = await response.json().catch(() => null);
      const channels = Array.isArray(payload?.channels) ? payload.channels : [];
      if (!channels.length) {
        setSlackHint('No Slack channels found. Refresh your Slack integration.');
        setSlackChannels([]);
        return;
      }
      setSlackChannels(channels.slice(0, 200));
      if (!slackChannelValue && !selectedNode?.slackChannel) {
        const fallbackValue = channels[0].id || channels[0].value || '';
        setSlackChannelValue(fallbackValue);
        setSelectedNode((prev) => (prev ? { ...prev, slackChannel: fallbackValue } : prev));
      }
    } catch (error) {
      console.error('[Sandbox:Next] Failed to hydrate Slack channels', error);
      setSlackError('Unable to load Slack channels. Please try again.');
    } finally {
      setSlackLoading(false);
    }
  }, [slackChannelValue, selectedNode, supabase]);

  const handleSlackChannelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSlackChannelValue(value);
    setSelectedNode((prev) => (prev ? { ...prev, slackChannel: value } : prev));
  };

  const handleSlackConnectClick = () => {
    if (typeof window === 'undefined') return;
    window.open('/settings/integrations', '_blank', 'noopener');
  };

  useEffect(() => {
    if (!isModalOpen) {
      setSlackChannels([]);
      setSlackChannelValue('');
      setSlackHint(null);
      setSlackError(null);
      setSlackLoading(false);
      return;
    }
    setSlackChannelValue(selectedNode?.slackChannel || '');
  }, [isModalOpen, selectedNode]);

  useEffect(() => {
    if (!isModalOpen || !selectedNode || selectedNode.type !== 'Action') return;
    hydrateSlackChannels();
  }, [hydrateSlackChannels, isModalOpen, selectedNode]);

  const collectGraph = useMemo(() => {
    return () => {
      const canvas = document.getElementById('main-canvas');
      if (!canvas) return { nodes: [] };
      const nodes = Array.from(canvas.querySelectorAll('.absolute.transform'))
        .map((el) => {
          const rect = (el as HTMLElement).style;
          const title = (el.querySelector('h3') as HTMLElement)?.textContent || '';
          const endpoint = (el.querySelector('.text-xs') as HTMLElement)?.textContent?.trim() || '';
          const type = (el.querySelector('p.text-xs')?.textContent || '').includes('Action') ? 'Action' : 'Trigger';
          return { title, endpoint, type, left: rect.left, top: rect.top };
        });
      return { nodes };
    };
  }, []);

  const handlePreviewJson = () => {
    const data = collectGraph();
    try { alert(JSON.stringify(data, null, 2)); } catch {}
  };

  const handleTestRun = async () => {
    setIsTesting(true);
    try {
      const data = collectGraph();
      const trigger = (data.nodes || []).find((n: any) => n.type === 'Trigger');
      const action = (data.nodes || []).find((n: any) => n.type === 'Action');
      const res = await fetch('/api/workflows/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_endpoint: trigger?.endpoint, action_endpoint: action?.endpoint }),
      });
      if (res.ok) {
        try { (window as any).toast?.success?.('Test completed successfully'); } catch {}
        alert('Test completed successfully');
      } else {
        alert('Test failed');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleActivate = async () => {
    const id = (workflowId as string) || '';
    const res = await fetch('/api/workflows/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: true }),
    });
    if (res.ok) {
      alert('Workflow activated');
    } else {
      alert('Failed to activate');
    }
  };

  const handleSave = async () => {
    const data = collectGraph();
    const body = { name: 'Sandbox Workflow', graph_data: data, trigger: {}, actions: [] } as any;
    if (workflowId) body.workflow_id = workflowId;
    const res = await fetch('/api/workflows/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      try { (window as any).toast?.success?.('Workflow added to your library 🎉'); } catch {}
      alert('Saved');
    } else {
      alert('Failed to save');
    }
  };

  const runRexAssist = async (prompt: string) => {
    const res = await fetch('/api/workflows/create_from_rex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (res.ok) {
      try { (window as any).toast?.success?.('REX built your automation 🎉'); } catch {}
      alert('REX built your automation 🎉');
    }
  };

  return (
    <>
      <div id="sandbox-container" className="flex h-screen">
        <div id="sidebar" className="w-72 bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
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
            </div>
          </div>
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
                <span className="text-purple-400 text-lg">🤝</span>
                <div>
                  <div className="font-medium">Create Client</div>
                  <div className="text-xs text-gray-400">/api/actions/create_client</div>
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
                <span className="text-purple-400 text-lg">🎯</span>
                <div>
                  <div className="font-medium">Trigger Sniper</div>
                  <div className="text-xs text-gray-400">/api/actions/capture_sniper</div>
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

        <div id="main-canvas" className="flex-1 relative overflow-hidden">
          <div id="canvas-background" className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 grid-pattern"></div>
          <div id="canvas-hint" className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg text-xs text-gray-300 border border-gray-800 floating-animation">
            <i className="fa-solid fa-lightbulb text-yellow-400 mr-2"></i>
            Drag nodes from the sidebar to create your automation workflow
          </div>

          <div id="workflow-node-1" className="absolute top-32 left-40 transform transition-all duration-200 hover:scale-105" style={{ cursor: 'move' }} data-node-type="Trigger">
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

          <div id="workflow-node-2" className="absolute top-32 left-96 transform transition-all duration-200 hover:scale-105" style={{ cursor: 'move' }} data-node-type="Action">
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

          <div id="drop-zone" className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300">
            <div className="absolute inset-4 border-2 border-dashed border-blue-400/50 rounded-xl bg-blue-400/5"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-400 text-lg font-medium">
              <i className="fa-solid fa-plus mr-2"></i>
              Drop node here to add to workflow
            </div>
          </div>
        </div>
      </div>

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
          <button onClick={handlePreviewJson} className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-code"></i>
            Preview JSON
          </button>
          <button onClick={handleTestRun} className={`bg-blue-700 hover:bg-blue-600 text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 ${isTesting ? 'animate-pulse border border-blue-400/50' : ''}`}>
            <i className="fa-solid fa-play"></i>
            Test Run
          </button>
          <button onClick={handleActivate} className="bg-green-700 hover:bg-green-600 text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-rocket"></i>
            Activate
          </button>
          <button onClick={() => runRexAssist('Build an enrichment → slack alert workflow')} className="bg-indigo-700 hover:bg-indigo-600 text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            💡 Build for Me
          </button>
          <button onClick={handleSave} className="bg-purple-700 hover:bg-purple-600 text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-save"></i>
            Save
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg p-6 border border-gray-200 dark:border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure {selectedNode?.type}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Title</label>
                <input
                  defaultValue={selectedNode?.title || ''}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Endpoint</label>
                <input
                  defaultValue={selectedNode?.endpoint || ''}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              {selectedNode?.type === 'Action' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Slack Channel</label>
                  <div className="flex gap-2 mt-1">
                    <select
                      value={slackChannelValue}
                      onChange={handleSlackChannelChange}
                      disabled={slackLoading || (slackChannels.length === 0 && !slackChannelValue)}
                      className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      {slackLoading && <option value="">Loading channels…</option>}
                      {!slackLoading && slackChannels.length === 0 && (
                        <option value="">{slackHint ? 'Connect Slack to continue' : 'No channels found'}</option>
                      )}
                      {slackChannels.map((channel) => {
                        const value = channel.id || channel.value || '';
                        const label = channel.name ? `#${channel.name}` : value || 'Unnamed channel';
                        return (
                          <option key={value || label} value={value}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={hydrateSlackChannels}
                      className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                      disabled={slackLoading}
                    >
                      {slackLoading ? 'Loading' : 'Refresh'}
                    </button>
                  </div>
                  {slackHint && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-2">
                      {slackHint}
                      <button
                        type="button"
                        onClick={handleSlackConnectClick}
                        className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                      >
                        Connect Slack
                      </button>
                    </p>
                  )}
                  {slackChannelValue && !slackHint && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Connected to channel:{' '}
                      <span className="text-gray-900 dark:text-gray-200 font-medium">
                        {selectedSlackChannelMeta?.name ? `#${selectedSlackChannelMeta.name}` : slackChannelValue}
                      </span>
                    </p>
                  )}
                  {slackError && <p className="text-xs text-red-400 mt-2">{slackError}</p>}
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Close
              </button>
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowConnectionPanel((prev) => !prev)}
        className="fixed top-24 right-6 z-40 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors"
      >
        {showConnectionPanel ? 'Hide Connections' : 'Show Connections'}
      </button>

      {showConnectionPanel && (
        <div className="fixed top-40 right-6 z-40 w-72 bg-gray-900/95 text-white border border-gray-700 rounded-xl shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500">Connection Helper</p>
              <p className="text-lg font-semibold">Active Links</p>
            </div>
            <button onClick={() => setShowConnectionPanel(false)} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
          {connectionSummary.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {connectionSummary.map((summary, idx) => (
                <li key={`${summary}-${idx}`} className="flex items-start gap-2">
                  <span className="mt-0.5 text-indigo-400">●</span>
                  <span>{summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No connections yet. Drag from a trigger to an action to link them.</p>
          )}
        </div>
      )}
    </>
  );
}


