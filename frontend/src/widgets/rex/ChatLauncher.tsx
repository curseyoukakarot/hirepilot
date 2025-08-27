import React from 'react';

type Props = {
  onClick: () => void;
  className?: string;
  pulse?: boolean;
};

export const ChatLauncher: React.FC<Props> = ({ onClick, className, pulse }) => {
  // Placeholder: replace with exact markup from #chat-launcher when provided
  return (
    <button
      aria-label="Open REX chat"
      onClick={onClick}
      className={
        'fixed bottom-6 right-6 z-[9999] inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 ' +
        (pulse ? 'rex-animate-pulse ' : '') +
        (className || '')
      }
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
        <path d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75a9.72 9.72 0 01-4.548-1.11L2.25 21.75l1.11-4.548A9.72 9.72 0 012.25 12z" />
      </svg>
    </button>
  );
};

export default ChatLauncher;


