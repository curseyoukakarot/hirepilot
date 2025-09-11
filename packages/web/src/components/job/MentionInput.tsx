import React, { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

const MOCK_USERS = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Charlie' },
];

export default function MentionInput({ value, onChange, onSubmit }: Props) {
  const [suggestions, setSuggestions] = useState<typeof MOCK_USERS>([]);
  const [index, setIndex] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!value.includes('@')) {
        setSuggestions([]);
        return;
      }
      const q = value.split('@').pop()?.toLowerCase() ?? '';
      setSuggestions(
        MOCK_USERS.filter((u) => u.name.toLowerCase().startsWith(q))
      );
    }, 200);
  }, [value]);

  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (index >= 0 && suggestions[index]) {
        const user = suggestions[index];
        const replaced = value.replace(/@[^\s]*$/, '@' + user.name + ' ');
        onChange(replaced);
        setSuggestions([]);
        setIndex(-1);
      } else {
        onSubmit();
      }
    }
  };

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={keyDown}
        className="w-full border rounded p-2 focus:outline-none"
        rows={3}
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 bg-white border rounded w-full mt-1 max-h-40 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === index ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              }`}
              onMouseDown={() => {
                const replaced = value.replace(/@[^\s]*$/, '@' + s.name + ' ');
                onChange(replaced);
                setSuggestions([]);
                setIndex(-1);
              }}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex justify-end">
        <button
          onClick={onSubmit}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
        >
          Post
        </button>
      </div>
    </div>
  );
}
