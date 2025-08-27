import React, { useState } from 'react';

type Props = {
  onSend: (text: string) => void;
  isSending?: boolean;
  quickActions?: React.ReactNode;
};

export const MessageComposer: React.FC<Props> = ({ onSend, isSending, quickActions }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    onSend(text);
    setText('');
  };

  return (
    <div className="border-t border-gray-200 p-3">
      {quickActions}
      <div className="mt-2 flex items-end gap-2">
        <textarea
          className="flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={2}
          placeholder="Ask REX..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;


