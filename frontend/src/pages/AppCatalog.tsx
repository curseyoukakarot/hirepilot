import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaEnvelope, FaChartBar, FaTable, FaColumns, FaHandshake, FaTasks,
  FaWpforms, FaGlobe, FaTerminal, FaRocket, FaUsers, FaKey, FaArrowLeft, FaCheck,
} from 'react-icons/fa';
import { useSidebarApps } from '../hooks/useSidebarApps';
import { APP_CATEGORIES, type AppDefinition, type AppCategory } from '../config/appRegistry';
import { usePlan } from '../context/PlanContext';

// ---------------------------------------------------------------------------
// Icon mapping (same as Sidebar)
// ---------------------------------------------------------------------------
const ICON_MAP: Record<string, React.ReactElement> = {
  FaEnvelope: <FaEnvelope />,
  FaChartBar: <FaChartBar />,
  FaTable: <FaTable />,
  FaColumns: <FaColumns />,
  FaHandshake: <FaHandshake />,
  FaTasks: <FaTasks />,
  FaWpforms: <FaWpforms />,
  FaGlobe: <FaGlobe />,
  FaTerminal: <FaTerminal />,
  FaRocket: <FaRocket />,
  FaUsers: <FaUsers />,
  FaKey: <FaKey />,
};

// ---------------------------------------------------------------------------
// Category colors for visual distinction
// ---------------------------------------------------------------------------
const CATEGORY_COLORS: Record<AppCategory, { bg: string; text: string; border: string }> = {
  productivity: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  communication: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  automation: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  data: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
};

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------
function ToggleSwitch({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
        ${enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out
          ${enabled ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// App Card Component
// ---------------------------------------------------------------------------
function AppCard({ app, enabled, onToggle, locked }: {
  app: AppDefinition;
  enabled: boolean;
  onToggle: () => void;
  locked: boolean;
}) {
  const colors = CATEGORY_COLORS[app.category];
  const icon = ICON_MAP[app.icon] || <FaTable />;

  return (
    <div
      className={`
        relative rounded-xl border p-5 transition-all duration-200
        ${enabled
          ? 'border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-800 shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-900/30'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${locked ? 'opacity-60' : ''}
      `}
    >
      {/* Enabled badge */}
      {enabled && (
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            <FaCheck className="text-[10px]" /> Active
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-xl ${colors.bg} ${colors.text}`}>
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {app.label}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {app.description}
          </p>
          {locked && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
              Upgrade to unlock
            </p>
          )}
        </div>
      </div>

      {/* Toggle */}
      <div className="mt-4 flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wider ${colors.text}`}>
          {APP_CATEGORIES[app.category].label}
        </span>
        <ToggleSwitch enabled={enabled} onToggle={onToggle} disabled={locked} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AppCatalog Page
// ---------------------------------------------------------------------------
export default function AppCatalog() {
  const navigate = useNavigate();
  const { isFree } = usePlan();
  const { allApps, enabledIds, toggleApp, isLoading } = useSidebarApps();

  // Group apps by category
  const categories = Object.entries(APP_CATEGORIES)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, meta]) => ({
      key: key as AppCategory,
      label: meta.label,
      apps: allApps.filter(a => a.category === key),
    }))
    .filter(cat => cat.apps.length > 0);

  const enabledCount = enabledIds.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4 transition-colors"
          >
            <FaArrowLeft className="text-xs" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Customize Your Workspace
          </h1>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
            Choose which apps appear in your sidebar. Toggle them on or off anytime.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-sm font-medium text-indigo-700 dark:text-indigo-300">
            {enabledCount} app{enabledCount !== 1 ? 's' : ''} active
          </div>
        </div>

        {isLoading ? (
          /* Loading skeleton */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
        ) : (
          /* App catalog by category */
          <div className="space-y-10">
            {categories.map(({ key, label, apps }) => (
              <section key={key}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {apps.map(app => {
                    const locked = Boolean(app.requiresPaidPlan && isFree);
                    return (
                      <AppCard
                        key={app.id}
                        app={app}
                        enabled={enabledIds.includes(app.id)}
                        onToggle={() => toggleApp(app.id)}
                        locked={locked}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
