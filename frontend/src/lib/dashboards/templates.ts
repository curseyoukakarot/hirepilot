export type TemplateRole = {
  id: string;
  label: string;
  required: boolean;
  // semantic type to help validation + UX badges
  kind: 'currency' | 'number' | 'date' | 'status' | 'category' | 'text';
  description?: string;
};

export type DashboardTemplate = {
  id: string;
  name: string;
  description: string;
  requirements: TemplateRole[];
};

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'exec_overview_v1',
    name: 'Executive Overview',
    description: 'Revenue, cost, profit, and margin — plus trends and a quick “at risk” view.',
    requirements: [
      { id: 'revenue', label: 'Revenue', required: true, kind: 'currency', description: 'Money column for revenue (SUM).' },
      { id: 'revenue_date', label: 'Revenue Date', required: true, kind: 'date', description: 'Date column for revenue trend bucketing.' },
      { id: 'cost', label: 'Cost', required: true, kind: 'currency', description: 'Money column for costs (SUM).' },
      { id: 'cost_date', label: 'Cost Date', required: true, kind: 'date', description: 'Date column for cost trend bucketing.' },
      { id: 'status', label: 'Status', required: false, kind: 'status', description: 'Optional status column for health/at-risk.' },
      { id: 'category', label: 'Category', required: false, kind: 'category', description: 'Optional category for breakdowns.' }
    ]
  },
  {
    id: 'pipeline_health_v1',
    name: 'Pipeline / Schedule Health',
    description: 'Upcoming items, approvals, and risk indicators for “event/project” style tables.',
    requirements: [
      { id: 'date', label: 'Event / Project Date', required: true, kind: 'date' },
      { id: 'status', label: 'Approval Status', required: false, kind: 'status' },
      { id: 'cash_required', label: 'Cash Required', required: false, kind: 'currency' },
      { id: 'owner', label: 'Owner', required: false, kind: 'text' }
    ]
  },
  {
    id: 'cost_drivers_v1',
    name: 'Cost Drivers',
    description: 'Understand what’s driving costs — category breakdown, top line items, and variance if available.',
    requirements: [
      { id: 'cost', label: 'Cost', required: true, kind: 'currency' },
      { id: 'category', label: 'Category', required: false, kind: 'category' },
      { id: 'baseline_cost', label: 'Baseline / Initial Cost', required: false, kind: 'currency' },
      { id: 'date', label: 'Date', required: false, kind: 'date' }
    ]
  }
];


