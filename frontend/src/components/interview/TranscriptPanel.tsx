import React from 'react';

export type TranscriptTurn = {
  id: string;
  speaker: 'rex' | 'user';
  text: string;
  timestamp: string;
  partial?: boolean;
  turnIndex?: number;
};

export type CoachingCard = {
  strength: { title: string; detail: string };
  opportunity: { title: string; detail: string };
  improved_version: { answer: string; bullets: string[] };
  tags: string[];
  score: {
    clarity: number;
    structure: number;
    specificity: number;
    relevance: number;
    confidence: number;
  };
  evidence_quotes: string[];
};

type TranscriptPanelProps = {
  turns: TranscriptTurn[];
  currentQuestion: number;
  totalQuestions: number;
  coaching?: CoachingCard | null;
};

function TranscriptPanel({ turns, currentQuestion, totalQuestions, coaching }: TranscriptPanelProps) {
  return (
    <section
      id="transcript-panel"
      className="hidden lg:flex w-[40%] h-full border-l border-white/5 bg-[#080808] flex-col relative z-20"
    >
      <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-[#080808]/95 backdrop-blur sticky top-0 z-10">
        <h2 className="text-sm font-medium text-gray-300">Live Transcript</h2>
        <div className="flex flex-col items-end">
          <div className="flex items-center text-xs text-gray-500 mb-1">
            <span className="text-white font-medium mr-1">Q{currentQuestion}</span> of {totalQuestions}
          </div>
          <div className="w-24 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, (currentQuestion / Math.max(1, totalQuestions)) * 100))}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 transcript-scroll pb-32">
        {turns.map((turn) =>
          turn.speaker === 'rex' ? (
            <div key={turn.id} className="flex flex-col space-y-3">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <i className="fa-solid fa-bolt text-[8px] text-white"></i>
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">REX</span>
                <span className="text-xs text-gray-600">{turn.timestamp}</span>
              </div>
              <div className="bg-[#121212] border border-white/5 p-5 rounded-2xl rounded-tl-none shadow-sm max-w-[90%]">
                <p className="text-gray-300 leading-relaxed text-sm">{turn.text}</p>
              </div>
            </div>
          ) : (
            <div key={turn.id} className="flex flex-col items-end space-y-3">
              <div className="flex items-center space-x-2 mb-1 flex-row-reverse space-x-reverse">
                <div className="w-5 h-5 rounded-full bg-gray-700 overflow-hidden">
                  <img
                    src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
                    alt="User"
                    className="w-full h-full object-cover opacity-80"
                  />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">You</span>
                <span className="text-xs text-gray-600">{turn.timestamp}</span>
              </div>
              <div className="text-right max-w-[90%] relative">
                {turn.partial ? (
                  <div className="absolute -left-6 top-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                ) : null}
                <p className={`${turn.partial ? 'text-gray-200' : 'text-gray-400'} leading-relaxed text-sm`}>{turn.text}</p>
              </div>
            </div>
          )
        )}
        {!turns.length ? (
          <div className="text-xs text-gray-500">Waiting for transcript...</div>
        ) : null}
        {coaching ? (
          <div className="relative group">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/20 to-transparent"></div>
            <div className="ml-8 mt-2">
              <div className="glass-panel p-4 rounded-xl border-l-2 border-l-blue-500 shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_25px_rgba(59,130,246,0.1)] transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-lightbulb text-yellow-500 text-xs"></i>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Instant Feedback</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5 w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-check text-[8px] text-green-400"></i>
                    </div>
                    <p className="text-xs text-gray-400">
                      <span className="text-gray-200 font-medium">{coaching.strength.title}:</span> {coaching.strength.detail}
                    </p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5 w-4 h-4 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-arrow-trend-up text-[8px] text-orange-400"></i>
                    </div>
                    <p className="text-xs text-gray-400">
                      <span className="text-gray-200 font-medium">{coaching.opportunity.title}:</span>{' '}
                      {coaching.opportunity.detail}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center text-xs text-blue-400 font-medium">
                      <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> See Improved Version
                    </div>
                    <p className="text-xs text-gray-300 mt-2 leading-relaxed">{coaching.improved_version.answer}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#080808] to-transparent pointer-events-none"></div>
    </section>
  );
}

export default React.memo(TranscriptPanel);
