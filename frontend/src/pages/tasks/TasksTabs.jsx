import React from 'react';

export default function TasksTabs({ tabs, activeTab, counts, onChange }) {
  return (
    <div className="mb-6">
      <div className="border-b border-gray-200">
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
                    ? 'border-indigo-500 text-indigo-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition'
                }
              >
                {tab.label}
                {showCount && (
                  <span
                    className={
                      isActive
                        ? 'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-600'
                        : isOverdue
                          ? 'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-red-100 text-red-600'
                          : 'ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500'
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
