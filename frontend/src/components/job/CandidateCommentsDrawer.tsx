import React, { useState } from 'react';
import MentionInput from './MentionInput';

interface Props {
  candidateName: string;
  onClose: () => void;
}

export default function CandidateCommentsDrawer({ candidateName, onClose }: Props) {
  const [comments, setComments] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const add = () => {
    if (!input.trim()) return;
    setComments([...comments, input.trim()]);
    setInput('');
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="w-80 h-full bg-white border-l border-gray-200 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Comments for {candidateName}</h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <div className="space-y-4 mb-4">
          {comments.map((c, i) => (
            <div key={i} className="bg-gray-50 rounded p-2 text-sm text-gray-700">
              {c}
            </div>
          ))}
        </div>
        <MentionInput value={input} onChange={setInput} onSubmit={add} />
      </div>
      <div className="flex-1" onClick={onClose} />
    </div>
  );
}
