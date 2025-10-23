import React, { useEffect } from 'react';

export default function SandboxPage() {
  useEffect(() => {
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

    // Make existing nodes draggable on mount
    document.querySelectorAll('[id^="workflow-node-"]').forEach((n) => makeNodeDraggable(n as HTMLElement));

    sidebar.addEventListener('dragstart', onDragStart as any);
    canvas.addEventListener('dragover', onDragOver as any);
    canvas.addEventListener('dragleave', onDragLeave as any);
    canvas.addEventListener('drop', onDrop as any);

    return () => {
      sidebar.removeEventListener('dragstart', onDragStart as any);
      canvas.removeEventListener('dragover', onDragOver as any);
      canvas.removeEventListener('dragleave', onDragLeave as any);
      canvas.removeEventListener('drop', onDrop as any);
    };
  }, []);

  return (
    <>
      <div id="sandbox-container" className="flex h-screen">
        {/* Left Sidebar */}
        <div id="sidebar" className="w-72 bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
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
          <button className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-code"></i>
            Preview JSON
          </button>
          <button className="bg-blue-700 hover:bg-blue-600 text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-play"></i>
            Test Run
          </button>
          <button className="bg-green-700 hover:bg-green-600 text-sm px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
            <i className="fa-solid fa-rocket"></i>
            Activate
          </button>
        </div>
      </div>
    </>
  );
}

