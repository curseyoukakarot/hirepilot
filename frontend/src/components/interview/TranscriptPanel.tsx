import React from 'react';

export type TranscriptTurn = {
  id: string;
  speaker: 'rex' | 'user';
  text: string;
  timestamp: string;
  partial?: boolean;
};

type TranscriptPanelProps = {
  turns: TranscriptTurn[];
  currentQuestion: number;
  totalQuestions: number;
};

function TranscriptPanel({ turns, currentQuestion, totalQuestions }: TranscriptPanelProps) {
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
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#080808] to-transparent pointer-events-none"></div>
    </section>
  );
}

export default React.memo(TranscriptPanel);
