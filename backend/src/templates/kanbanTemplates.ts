import type { KanbanTemplate } from '../../../shared/kanbanTypes';

export const KANBAN_TEMPLATES: KanbanTemplate[] = [
  {
    id: 'recruiting_pipeline',
    name: 'Recruiting Pipeline',
    boardType: 'recruiting_pipeline',
    lists: [
      { name: 'New Lead', color: '#38bdf8', position: 1 },
      { name: 'Contacted', color: '#818cf8', position: 2 },
      { name: 'Screening', color: '#22c55e', position: 3 },
      { name: 'Interview', color: '#f97316', position: 4 },
      { name: 'Offer Sent', color: '#eab308', position: 5 },
      { name: 'Hired', color: '#10b981', position: 6 },
    ],
    labels: [
      { name: 'Qualified', color: '#22c55e' },
      { name: 'Interview', color: '#f97316' },
      { name: 'Offer Sent', color: '#eab308' },
      { name: 'On Hold', color: '#94a3b8' },
    ],
  },
  {
    id: 'client_acquisition',
    name: 'Client Acquisition',
    boardType: 'client_acquisition',
    lists: [
      { name: 'Prospects', color: '#38bdf8', position: 1 },
      { name: 'Discovery', color: '#60a5fa', position: 2 },
      { name: 'Proposal', color: '#a78bfa', position: 3 },
      { name: 'Negotiation', color: '#f59e0b', position: 4 },
      { name: 'Closed Won', color: '#22c55e', position: 5 },
    ],
    labels: [
      { name: 'Warm', color: '#f59e0b' },
      { name: 'Hot', color: '#ef4444' },
      { name: 'Inbound', color: '#10b981' },
    ],
  },
  {
    id: 'delivery_execution',
    name: 'Delivery Execution',
    boardType: 'delivery_execution',
    lists: [
      { name: 'Backlog', color: '#94a3b8', position: 1 },
      { name: 'In Progress', color: '#38bdf8', position: 2 },
      { name: 'Review', color: '#f97316', position: 3 },
      { name: 'Done', color: '#22c55e', position: 4 },
    ],
    labels: [
      { name: 'Blocked', color: '#ef4444' },
      { name: 'High Priority', color: '#f59e0b' },
      { name: 'QA', color: '#6366f1' },
    ],
  },
];

export const KANBAN_TEMPLATES_BY_ID = new Map(KANBAN_TEMPLATES.map((t) => [t.id, t]));

