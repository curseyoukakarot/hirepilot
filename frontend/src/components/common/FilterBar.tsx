import React from 'react';

interface FilterBarProps {
  filters: string[];
  active: string[];
  onToggle: (filter: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, active, onToggle }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {filters.map((f) => {
        const selected = active.includes(f);
        return (
          <button
            key={f}
            onClick={() => onToggle(f)}
            className={`px-3 py-1 rounded-full text-sm border ${
              selected
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
};

export default FilterBar;
