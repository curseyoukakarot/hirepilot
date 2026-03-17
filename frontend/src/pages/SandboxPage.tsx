import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '../lib/supabaseClient';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type SlackChannel = { id?: string; name?: string; value?: string };

/* ------------------------------------------------------------------ */
/*  Custom Node Components                                             */
/* ------------------------------------------------------------------ */
function TriggerNode({ data, selected }: any) {
  return (
    <div className={`bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-xl shadow-lg border ${selected ? 'border-blue-300 ring-2 ring-blue-400/40' : 'border-blue-400/20'} w-60 relative`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{data.icon || '\u26A1'}</span>
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm truncate">{data.label}</div>
          <div className="text-[11px] text-blue-200">Trigger</div>
        </div>
      </div>
      <div className="text-[11px] text-blue-100 bg-blue-900/30 rounded-md px-2 py-1 truncate">{data.endpoint}</div>
      <Handle type="source" position={Position.Right} className="!w-3.5 !h-3.5 !bg-blue-400 !border-2 !border-white !shadow-md" />
    </div>
  );
}

function ActionNode({ data, selected }: any) {
  return (
    <div className={`bg-gradient-to-br from-purple-600 to-purple-800 p-4 rounded-xl shadow-lg border ${selected ? 'border-purple-300 ring-2 ring-purple-400/40' : 'border-purple-400/20'} w-60 relative`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{data.icon || '\u2699\uFE0F'}</span>
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm truncate">{data.label}</div>
          <div className="text-[11px] text-purple-200">Action</div>
        </div>
      </div>
      <div className="text-[11px] text-purple-100 bg-purple-900/30 rounded-md px-2 py-1 truncate">{data.endpoint}</div>
      {data.slackChannel && (
        <div className="text-[10px] text-purple-300 mt-1 truncate">Channel: #{data.slackChannel}</div>
      )}
      <Handle type="target" position={Position.Left} className="!w-3.5 !h-3.5 !bg-purple-400 !border-2 !border-white !shadow-md" />
      <Handle type="source" position={Position.Right} id="action-out" className="!w-3.5 !h-3.5 !bg-purple-400 !border-2 !border-white !shadow-md" />
    </div>
  );
}

const nodeTypes: NodeTypes = { trigger: TriggerNode, action: ActionNode };

/* ------------------------------------------------------------------ */
/*  Sidebar Data                                                       */
/* ------------------------------------------------------------------ */
const TRIGGERS = [
  { icon: '\uD83D\uDC64', label: 'Lead Created', endpoint: '/api/events/lead_created' },
  { icon: '\uD83C\uDF89', label: 'Candidate Hired', endpoint: '/api/events/candidate_hired' },
  { icon: '\uD83D\uDE80', label: 'Campaign Relaunched', endpoint: '/api/events/campaign_relaunched' },
  { icon: '\uD83C\uDFF7\uFE0F', label: 'Lead Tagged', endpoint: '/api/events/lead_tagged' },
  { icon: '\uD83D\uDD17', label: 'Lead Source Detected', endpoint: '/api/events/lead_source_triggered' },
];

const ACTIONS = [
  { icon: '\uD83D\uDCC8', label: 'Submit to Client', endpoint: '/api/actions/submit_to_client' },
  { icon: '\uD83D\uDCAC', label: 'Send Bulk Message', endpoint: '/api/actions/bulk_schedule' },
  { icon: '\uD83E\uDD1D', label: 'Create Client', endpoint: '/api/actions/create_client' },
  { icon: '\uD83E\uDDE0', label: 'Sync Enrichment', endpoint: '/api/actions/sync_enrichment' },
  { icon: '\uD83C\uDFAF', label: 'Trigger Sniper', endpoint: '/api/actions/capture_sniper' },
  { icon: '\uD83E\uDD16', label: 'Trigger REX Chat', endpoint: '/api/actions/rex_chat' },
  { icon: '\uD83D\uDCE3', label: 'Send Slack Alert', endpoint: '/api/actions/slack_notification' },
  { icon: '\uD83D\uDCE7', label: 'Send Email', endpoint: '/api/actions/send_email' },
];

/* ------------------------------------------------------------------ */
/*  Sidebar Item                                                       */
/* ------------------------------------------------------------------ */
function SidebarItem({ icon, label, endpoint, type }: { icon: string; label: string; endpoint: string; type: 'trigger' | 'action' }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType: type, data: { icon, label, endpoint } }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const isTrigger = type === 'trigger';
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`cursor-grab active:cursor-grabbing p-3 rounded-lg flex items-center gap-3 text-sm transition-all border ${
        isTrigger
          ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-blue-500/50'
          : 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-purple-500/50'
      }`}
    >
      <span className={`text-lg ${isTrigger ? 'text-blue-400' : 'text-purple-400'}`}>{icon}</span>
      <div className="min-w-0">
        <div className="font-medium text-white text-sm truncate">{label}</div>
        <div className="text-[10px] text-gray-400 truncate">{endpoint}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Config Panel (right side - replaces modal)                         */
/* ------------------------------------------------------------------ */
function ConfigPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
  slackChannels,
  slackLoading,
  slackHint,
  slackError,
  onRefreshSlack,
}: {
  node: Node;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  slackChannels: SlackChannel[];
  slackLoading: boolean;
  slackHint: string | null;
  slackError: string | null;
  onRefreshSlack: () => void;
}) {
  const [label, setLabel] = useState(String(node.data.label || ''));
  const [endpoint, setEndpoint] = useState(String(node.data.endpoint || ''));
  const [slackChannel, setSlackChannel] = useState(String(node.data.slackChannel || ''));
  const isAction = node.type === 'action';

  useEffect(() => {
    setLabel(String(node.data.label || ''));
    setEndpoint(String(node.data.endpoint || ''));
    setSlackChannel(String(node.data.slackChannel || ''));
  }, [node.id, node.data]);

  const handleSave = () => {
    onUpdate(node.id, { ...node.data, label, endpoint, slackChannel: isAction ? slackChannel : undefined });
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 p-5 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-white">Configure {isAction ? 'Action' : 'Trigger'}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
      </div>

      <div className="space-y-4 flex-1">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Endpoint</label>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-xs"
          />
        </div>

        {isAction && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Slack Channel</label>
            <div className="flex gap-2">
              <select
                value={slackChannel}
                onChange={(e) => setSlackChannel(e.target.value)}
                disabled={slackLoading || (!slackChannels.length && !slackChannel)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500"
              >
                {slackLoading && <option value="">Loading...</option>}
                {!slackLoading && !slackChannels.length && <option value="">{slackHint || 'No channels'}</option>}
                <option value="">None</option>
                {slackChannels.map((ch) => {
                  const v = ch.id || ch.value || '';
                  return <option key={v} value={v}>{ch.name ? `#${ch.name}` : v}</option>;
                })}
              </select>
              <button onClick={onRefreshSlack} disabled={slackLoading} className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-xs hover:bg-gray-700">
                {slackLoading ? '...' : '\u21BB'}
              </button>
            </div>
            {slackHint && (
              <p className="text-[11px] text-gray-500 mt-1">
                {slackHint}{' '}
                <button onClick={() => window.open('/settings/integrations', '_blank')} className="text-blue-400 hover:underline">Connect Slack</button>
              </p>
            )}
            {slackError && <p className="text-[11px] text-red-400 mt-1">{slackError}</p>}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-2">
        <button onClick={handleSave} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition">
          Save Changes
        </button>
        <button onClick={() => onDelete(node.id)} className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm font-medium transition border border-red-600/30">
          Delete Node
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Default Nodes & Edges                                              */
/* ------------------------------------------------------------------ */
const defaultInitialNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 120, y: 220 },
    data: { label: 'Candidate Hired', endpoint: '/api/events/candidate_hired', icon: '\uD83C\uDF89' },
  },
  {
    id: 'action-1',
    type: 'action',
    position: { x: 520, y: 220 },
    data: { label: 'Send Slack Alert', endpoint: '/api/actions/slack_notification', icon: '\uD83D\uDCE3', slackChannel: '' },
  },
];

const defaultInitialEdges: Edge[] = [
  {
    id: 'e-trigger-1-action-1',
    source: 'trigger-1',
    target: 'action-1',
    animated: true,
    style: { stroke: '#6366f1', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
  },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function SandboxPage() {
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get('workflowId') || '';

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(defaultInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultInitialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // UI state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Slack state
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackHint, setSlackHint] = useState<string | null>(null);
  const [slackError, setSlackError] = useState<string | null>(null);

  // Load saved graph from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hp_sandbox_graph_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.nodes) && parsed.nodes.length) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges || []);
          if (parsed.name) setWorkflowName(parsed.name);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('hp_sandbox_graph_v2', JSON.stringify({ nodes, edges, name: workflowName }));
      } catch { /* ignore */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [nodes, edges, workflowName]);

  /* -- Slack channel hydration -- */
  const hydrateSlackChannels = useCallback(async () => {
    setSlackLoading(true);
    setSlackError(null);
    setSlackHint(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        setSlackHint('Connect Slack from Settings \u2192 Integrations.');
        setSlackChannels([]);
        return;
      }
      const res = await fetch('/api/slack/channels', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        setSlackHint('Connect Slack from Settings \u2192 Integrations.');
        setSlackChannels([]);
        return;
      }
      if (!res.ok) throw new Error(`Slack request failed (${res.status})`);
      const payload = await res.json().catch(() => null);
      const channels = Array.isArray(payload?.channels) ? payload.channels : [];
      if (!channels.length) {
        setSlackHint('No Slack channels found. Refresh your integration.');
        setSlackChannels([]);
        return;
      }
      setSlackChannels(channels.slice(0, 200));
    } catch (err) {
      console.error('[Sandbox] Failed to hydrate Slack channels', err);
      setSlackError('Unable to load Slack channels.');
    } finally {
      setSlackLoading(false);
    }
  }, []);

  // Hydrate slack when an action node is selected
  useEffect(() => {
    if (selectedNode?.type === 'action') hydrateSlackChannels();
  }, [selectedNode?.id, selectedNode?.type]);

  /* -- Connection handling -- */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const target = nodes.find((n) => n.id === connection.target);
      if (target?.type === 'trigger') return false;
      return true;
    },
    [nodes],
  );

  /* -- Drag & drop from sidebar -- */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/reactflow');
      if (!raw || !reactFlowInstance) return;
      const { nodeType, data: nodeData } = JSON.parse(raw);
      const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: { ...nodeData, slackChannel: '' },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  /* -- Node selection -- */
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  /* -- Config panel actions -- */
  const updateNodeData = useCallback(
    (id: string, newData: any) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: newData } : n)));
      setSelectedNode((prev) => (prev?.id === id ? { ...prev, data: newData } as Node : prev));
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNode(null);
    },
    [setNodes, setEdges],
  );

  /* -- Toolbar actions -- */
  const collectGraph = useCallback(() => ({
    nodes: nodes.map((n) => ({
      id: n.id, type: n.type, label: n.data.label, endpoint: n.data.endpoint,
      icon: n.data.icon, slackChannel: n.data.slackChannel, position: n.position,
    })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
  }), [nodes, edges]);

  const handlePreviewJson = () => {
    alert(JSON.stringify(collectGraph(), null, 2));
  };

  const handleTestRun = async () => {
    setIsTesting(true);
    try {
      const trigger = nodes.find((n) => n.type === 'trigger');
      const action = nodes.find((n) => n.type === 'action');
      const res = await fetch('/api/workflows/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_endpoint: trigger?.data.endpoint, action_endpoint: action?.data.endpoint }),
      });
      alert(res.ok ? 'Test completed successfully!' : 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const graph = collectGraph();
      const body: any = { name: workflowName, graph_data: graph, trigger: {}, actions: [] };
      if (workflowId) body.workflow_id = workflowId;
      const res = await fetch('/api/workflows/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      alert(res.ok ? 'Workflow saved!' : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async () => {
    const res = await fetch('/api/workflows/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: workflowId || '', is_active: true }),
    });
    alert(res.ok ? 'Workflow activated!' : 'Failed to activate');
  };

  const handleBuildForMe = async () => {
    const res = await fetch('/api/workflows/create_from_rex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Build an enrichment \u2192 slack alert workflow' }),
    });
    if (res.ok) alert('REX built your automation!');
  };

  const handleReset = () => {
    setNodes(defaultInitialNodes);
    setEdges(defaultInitialEdges);
    setSelectedNode(null);
    setWorkflowName('Untitled Workflow');
  };

  const triggerCount = nodes.filter((n) => n.type === 'trigger').length;
  const actionCount = nodes.filter((n) => n.type === 'action').length;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Top Bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-5 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <a href="/workflows" className="text-gray-400 hover:text-white text-sm flex items-center gap-1.5 transition">
            <i className="fa-solid fa-arrow-left text-xs"></i> Workflows
          </a>
          <div className="h-5 w-px bg-gray-700" />
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent border-none text-lg font-semibold text-white focus:outline-none focus:ring-0 w-64"
            placeholder="Workflow name..."
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {triggerCount} trigger{triggerCount !== 1 ? 's' : ''} &middot; {actionCount} action{actionCount !== 1 ? 's' : ''} &middot; {edges.length} connection{edges.length !== 1 ? 's' : ''}
          </span>
          <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm rounded-lg font-medium transition disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-gray-900 border-r border-gray-800 p-4 flex flex-col overflow-y-auto shrink-0">
          <div className="mb-6">
            <h2 className="text-xs font-semibold mb-3 text-blue-400 flex items-center gap-2 uppercase tracking-wider">
              <i className="fa-solid fa-bolt text-[10px]"></i> Triggers
            </h2>
            <div className="space-y-1.5">
              {TRIGGERS.map((t) => <SidebarItem key={t.endpoint} {...t} type="trigger" />)}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xs font-semibold mb-3 text-purple-400 flex items-center gap-2 uppercase tracking-wider">
              <i className="fa-solid fa-cog text-[10px]"></i> Actions
            </h2>
            <div className="space-y-1.5">
              {ACTIONS.map((a) => <SidebarItem key={a.endpoint} {...a} type="action" />)}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-gray-800">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Drag</strong> nodes onto the canvas.{' '}
              <strong className="text-gray-400">Connect</strong> by dragging handles.{' '}
              <strong className="text-gray-400">Click</strong> a node to configure.
            </p>
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            className="bg-gray-950"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
            }}
          >
            <Background color="#374151" gap={20} size={1} />
            <Controls className="!bg-gray-800 !border-gray-700 !rounded-lg [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700" />
            <MiniMap
              nodeColor={(n) => (n.type === 'trigger' ? '#3b82f6' : '#8b5cf6')}
              maskColor="rgba(0,0,0,0.7)"
              className="!bg-gray-900 !border-gray-700 !rounded-lg"
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center text-gray-500">
                <div className="text-5xl mb-3 opacity-30">+</div>
                <p className="text-lg font-medium">Drag nodes from the sidebar</p>
                <p className="text-sm">to start building your workflow</p>
              </div>
            </div>
          )}
        </div>

        {/* Config Panel (right) */}
        {selectedNode && (
          <ConfigPanel
            node={selectedNode}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
            slackChannels={slackChannels}
            slackLoading={slackLoading}
            slackHint={slackHint}
            slackError={slackError}
            onRefreshSlack={hydrateSlackChannels}
          />
        )}
      </div>

      {/* Bottom Toolbar */}
      <footer className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 px-5 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-xs flex items-center gap-2">
            <i className="fa-solid fa-info-circle"></i>
            Drag &amp; connect nodes to build automations
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
            REX Engine Connected
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5 text-gray-300">
            <i className="fa-solid fa-rotate-left"></i> Reset
          </button>
          <button onClick={handlePreviewJson} className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5 text-gray-300">
            <i className="fa-solid fa-code"></i> JSON
          </button>
          <button onClick={handleTestRun} disabled={isTesting} className={`bg-blue-700 hover:bg-blue-600 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${isTesting ? 'animate-pulse' : ''}`}>
            <i className="fa-solid fa-play"></i> Test
          </button>
          <button onClick={handleActivate} className="bg-green-700 hover:bg-green-600 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5">
            <i className="fa-solid fa-rocket"></i> Activate
          </button>
          <button onClick={handleBuildForMe} className="bg-indigo-700 hover:bg-indigo-600 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5">
            &#x1F4A1; Build for Me
          </button>
          <button onClick={handleSave} disabled={isSaving} className="bg-purple-700 hover:bg-purple-600 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50">
            <i className="fa-solid fa-save"></i> Save
          </button>
        </div>
      </footer>
    </div>
  );
}
