import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Appearance</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">Switch between light and dark mode</div>
      </div>
      <button
        onClick={toggleTheme}
        role="switch"
        aria-checked={isDark}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          isDark ? 'bg-indigo-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            isDark ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}


