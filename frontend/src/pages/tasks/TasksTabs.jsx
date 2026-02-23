import React from 'react';

export default function TasksTabs({ tabs, activeTab, counts, onChange }) {
  return (
    <div className="mb-6">
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex space-x-8 overflow-x-auto hide-scrollbar" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            const count = counts[tab.key];
            const showCount = typeof count === 'number';
            const isOverdue = tab.key === 'overdue';

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChange(tab.key)}
                className={
                  isActive
                    ? 'border-primary-500 text-primary-400 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition'
                }
              >
                {tab.label}
                {showCount && (
                  <span
                    className={
                      isActive
                        ? 'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-primary-600/20 text-primary-400'
                        : isOverdue
                          ? 'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-red-600/20 text-red-400'
                          : 'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-dark-200 text-gray-400'
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
