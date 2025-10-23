import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';

type NodeConfig = {
  title: string;
  endpoint: string;
  type: 'Trigger' | 'Action';
};

export default function SandboxPage() {
  const router = useRouter();
  const { workflowId } = router.query as { workflowId?: string };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeConfig | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    let isDragging = false as boolean;
    let draggedElement: HTMLElement | null = null;
    const dragOffset = { x: 0, y: 0 } as { x: number; y: number };

    const sidebar = document.getElementById('sidebar');
    const canvas = document.getElementById('main-canvas');
    const dropZone = document.getElementById('drop-zone') as HTMLElement | null;

    if (!sidebar || !canvas) return;

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
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          const x = e.clientX - canvasRect.left - dragOffset.x;
          const y = e.clientY - canvasRect.top - dragOffset.y;
          const nx = Math.max(0, Math.min(x, canvasRect.width - 256));
          const ny = Math.max(0, Math.min(y, canvasRect.height - 100));
          node.style.left = nx + 'px';
          node.style.top = ny + 'px';
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
    };

    const createWorkflowNode = (sourceElement: HTMLElement, x: number, y: number) => {
      const isAction = sourceElement.classList.contains('action-node');
      const nodeData = extractNodeData(sourceElement);
      const workflowNode = document.createElement('div');
      workflowNode.className = 'absolute transform transition-all duration-200 hover:scale-105';
      workflowNode.style.left = x - 128 + 'px';
      workflowNode.style.top = y - 50 + 'px';
      (workflowNode.style as any).cursor = 'move';
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
                <div class="absolute ${isAction ? '-left-2' : '-right-2'} top-1/2 transform -translate-y-1/2 w-4 h-4 ${isAction ? 'bg-purple-400' : 'bg-blue-400'} rounded-full border-2 border-white shadow-lg"></div>
            </div>
        `;
      canvas.appendChild(workflowNode);
      makeNodeDraggable(workflowNode);
    };

    const onDomContentLoaded = () => {
      // Make existing nodes draggable
      document.querySelectorAll('[id^="workflow-node-"]')
        .forEach((n) => makeNodeDraggable(n as HTMLElement));
    };

    sidebar.addEventListener('dragstart', onDragStart as any);
    canvas.addEventListener('dragover', onDragOver as any);
    canvas.addEventListener('dragleave', onDragLeave as any);
    canvas.addEventListener('drop', onDrop as any);
    document.addEventListener('DOMContentLoaded', onDomContentLoaded);
    // In case DOMContentLoaded already fired in SPA
    onDomContentLoaded();

    return () => {
      sidebar.removeEventListener('dragstart', onDragStart as any);
      canvas.removeEventListener('dragover', onDragOver as any);
      canvas.removeEventListener('dragleave', onDragLeave as any);
      canvas.removeEventListener('drop', onDrop as any);
      document.removeEventListener('DOMContentLoaded', onDomContentLoaded);
    };
  }, []);

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

          <svg id="connection-svg" className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 as any }}>
            <defs>
              <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <path d="M 216 160 Q 280 160 320 160" stroke="url(#connectionGradient)" strokeWidth="3" fill="none" className="connection-line" />
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Configure {selectedNode?.type}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400">Title</label>
                <input defaultValue={selectedNode?.title || ''} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-400">Endpoint</label>
                <input defaultValue={selectedNode?.endpoint || ''} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-800 rounded-lg">Close</button>
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-indigo-600 rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


