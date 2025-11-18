import React, { useMemo, useState } from 'react';

export type Strategy = {
  tone: 'professional' | 'conversational' | 'warm' | 'direct' | 'enterprise' | 'highenergy';
  priority: 'book' | 'warm' | 'qualify' | 'objection' | 'soft';
  instructions?: string;
};

export default function SalesAgentStrategyModal({
  open,
  initial,
  onCancel,
  onSave
}: {
  open: boolean;
  initial: Strategy;
  onCancel: () => void;
  onSave: (s: Strategy) => void;
}) {
  const init = useMemo<Strategy>(() => initial || { tone: 'professional', priority: 'book', instructions: '' }, [initial]);
  const [tone, setTone] = useState<Strategy['tone']>(init.tone);
  const [priority, setPriority] = useState<Strategy['priority']>(init.priority);
  const [instructions, setInstructions] = useState<string>(init.instructions || '');
  const [showExamples, setShowExamples] = useState<boolean>(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in flex">
      <div className="w-full max-w-xl rounded-2xl bg-[#0f1115] border border-white/10 shadow-xl p-6 animate-scale-in text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Sales Agent Response Strategy</h2>
          <button className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-gray-200 transition-colors" onClick={onCancel} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 8.586l4.95-4.95a1 1 0 111.414 1.414L11.414 10l4.95 4.95a1 1 0 01-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 01-1.414-1.414L8.586 10l-4.95-4.95A1 1 0 115.05 3.636L10 8.586z" clipRule="evenodd"/></svg>
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Tell REX how to respond to interested prospects. These settings act as a strategy guide — REX still adapts intelligently to each message.
        </p>

        <div className="mb-6">
          <label className="block text-gray-300 text-sm mb-2">Tone</label>
          <select value={tone} onChange={(e)=> setTone(e.target.value as Strategy['tone'])} className="w-full bg-[#181a20] border border-white/10 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
            <option value="professional">Professional</option>
            <option value="conversational">Conversational</option>
            <option value="warm">Warm & friendly</option>
            <option value="direct">Direct & concise</option>
            <option value="enterprise">Enterprise polished</option>
            <option value="highenergy">High-energy</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-gray-300 text-sm mb-2">Goal priority</label>
          <select value={priority} onChange={(e)=> setPriority(e.target.value as Strategy['priority'])} className="w-full bg-[#181a20] border border-white/10 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all">
            <option value="book">Book a meeting ASAP</option>
            <option value="warm">Warm before booking</option>
            <option value="qualify">Qualify first</option>
            <option value="objection">Handle objections → then book</option>
            <option value="soft">Keep it soft / relationship-focused</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-2">Custom instructions</label>
          <textarea
            value={instructions}
            onChange={(e)=> setInstructions(e.target.value)}
            rows={4}
            placeholder="Example: Avoid sounding salesy. Always confirm availability if they offer times. Mention pricing link only if asked."
            className="w-full bg-[#181a20] border border-white/10 rounded-xl p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all resize-none"
          />
        </div>

        <button className="text-blue-400 text-sm hover:text-blue-300 underline mb-3 transition-colors" onClick={()=> setShowExamples(v=> !v)}>
          {showExamples ? 'Hide examples' : 'Show examples'}
        </button>
        {showExamples && (
          <div className="bg-[#14161b] text-gray-300 text-sm rounded-lg border border-white/5 p-3 space-y-2 mb-4 animate-slide-up">
            <p>• "If they ask about pricing, include our pricing page."</p>
            <p>• "If they seem unsure, suggest a short intro call."</p>
            <p>• "Stay concise — no more than 3–4 sentences."</p>
            <p>• "Acknowledge what they said before pivoting to the CTA."</p>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-8">
          <button className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors" onClick={onCancel}>Cancel</button>
          <button
            className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-lg transition-colors"
            onClick={()=> onSave({ tone, priority, instructions })}
          >
            Save Strategy
          </button>
        </div>
      </div>
    </div>
  );
}


