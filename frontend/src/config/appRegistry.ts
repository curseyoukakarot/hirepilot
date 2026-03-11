/**
 * App Registry — single source of truth for all sidebar app definitions.
 *
 * Available Apps: user-customizable items that can be added/removed from the sidebar.
 * Standard Items: always-visible sidebar items that cannot be removed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppCategory = 'productivity' | 'communication' | 'automation' | 'data';

export interface AppDefinition {
  id: string;
  label: string;
  route: string;
  /** react-icons import name — resolved to component in the sidebar */
  icon: string;
  description: string;
  category: AppCategory;
  /** If set, app is only available to users with these roles */
  requiresPaidPlan?: boolean;
}

export interface StandardItem {
  id: string;
  label: string;
  route: string;
  icon: string;
  /** If true, only shown for paid users */
  requiresPaidPlan?: boolean;
  /** If true, only shown for users with workflow access */
  requiresWorkflowAccess?: boolean;
}

// ---------------------------------------------------------------------------
// Category metadata (for display in the catalog)
// ---------------------------------------------------------------------------

export const APP_CATEGORIES: Record<AppCategory, { label: string; order: number }> = {
  productivity: { label: 'Productivity', order: 1 },
  communication: { label: 'Communication', order: 2 },
  automation: { label: 'Automation', order: 3 },
  data: { label: 'Data & Tools', order: 4 },
};

// ---------------------------------------------------------------------------
// Available Apps (user-customizable)
// ---------------------------------------------------------------------------

export const APP_REGISTRY: AppDefinition[] = [
  {
    id: 'tables',
    label: 'Tables',
    route: '/tables',
    icon: 'FaTable',
    description: 'Create and manage custom data tables for tracking anything.',
    category: 'data',
  },
  {
    id: 'kanban',
    label: 'Kanban',
    route: '/kanban',
    icon: 'FaColumns',
    description: 'Visual board view for managing pipelines and workflows.',
    category: 'productivity',
  },
  {
    id: 'deals',
    label: 'Deals',
    route: '/deals',
    icon: 'FaHandshake',
    description: 'Track opportunities, proposals, and deal pipelines.',
    category: 'productivity',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    route: '/tasks',
    icon: 'FaTasks',
    description: 'Organize and track to-dos, assignments, and deadlines.',
    category: 'productivity',
  },
  {
    id: 'forms',
    label: 'Forms',
    route: '/forms',
    icon: 'FaWpforms',
    description: 'Build custom forms for data collection and intake.',
    category: 'data',
  },
  {
    id: 'landing-pages',
    label: 'Landing Pages',
    route: '/prep/landing-page',
    icon: 'FaGlobe',
    description: 'Design and publish landing pages for campaigns.',
    category: 'data',
    requiresPaidPlan: true,
  },
  {
    id: 'agent-mode',
    label: 'Agent Mode',
    route: '/agent',
    icon: 'FaTerminal',
    description: 'AI-powered agent for advanced campaign management.',
    category: 'automation',
  },
  {
    id: 'messages',
    label: 'Messages',
    route: '/messages',
    icon: 'FaEnvelope',
    description: 'View and manage all your messaging conversations.',
    category: 'communication',
  },
  {
    id: 'cloud-engine',
    label: 'Cloud Engine',
    route: '/sniper',
    icon: 'FaRocket',
    description: 'Automated LinkedIn outreach and sourcing at scale.',
    category: 'automation',
  },
  {
    id: 'personas',
    label: 'Personas',
    route: '/agent/advanced/personas',
    icon: 'FaUsers',
    description: 'Create and manage AI personas for outreach campaigns.',
    category: 'automation',
  },
  {
    id: 'api-key',
    label: 'API Key',
    route: '/workflows',
    icon: 'FaKey',
    description: 'Access your API key for third-party integrations.',
    category: 'data',
  },
];

// ---------------------------------------------------------------------------
// Default Apps — enabled for first-time users (mirrors current sidebar)
// ---------------------------------------------------------------------------

export const DEFAULT_APPS: string[] = [
  'messages',
  'tables',
  'kanban',
  'tasks',
  'forms',
];

// ---------------------------------------------------------------------------
// Standard Items — always shown, not removable
// ---------------------------------------------------------------------------

export const STANDARD_ITEMS: StandardItem[] = [
  { id: 'settings', label: 'Settings', route: '/settings', icon: 'FaCog' },
  { id: 'billing', label: 'Billing', route: '/billing', icon: 'FaCreditCard' },
  { id: 'analytics', label: 'Analytics', route: '/analytics', icon: 'FaChartBar', requiresPaidPlan: true },
  { id: 'workflows', label: 'Workflows', route: '/workflows', icon: 'FaPlug', requiresWorkflowAccess: true },
  { id: 'rex-chat', label: 'REX Chat', route: '/rex-chat', icon: 'FaRobot' },
];

// ---------------------------------------------------------------------------
// Valid app IDs (for server-side validation)
// ---------------------------------------------------------------------------

export const VALID_APP_IDS: string[] = APP_REGISTRY.map(a => a.id);
