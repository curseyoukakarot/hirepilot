import React from 'react';

type Props = {
  suggestions?: string[];
  onPick: (text: any) => void;
};

export const QuickSuggestions: React.FC<Props> = ({ suggestions, onPick }) => {
  const items = suggestions && suggestions.length > 0
    ? suggestions
    : [
        'How do I launch a campaign?',
        "What's included in Pro plan?",
        'Book a demo',
      ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s, i) => (
        <button
          key={`${i}-${s}`}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
};

export default QuickSuggestions;


