import React from 'react';
import RexOrb from './RexOrb';

type VoiceStageProps = {
  statusText: string;
  mode: 'idle' | 'user' | 'rex';
  intensity: number;
  onMicClick: () => void;
  micBusy?: boolean;
  debugState?: string;
  showDebug?: boolean;
};

export default function VoiceStage({
  statusText,
  mode,
  intensity,
  onMicClick,
  micBusy = false,
  debugState = '',
  showDebug = false,
}: VoiceStageProps) {
  return (
    <section
      id="voice-stage"
      className="w-full lg:w-[60%] h-full flex flex-col items-center justify-center relative bg-gradient-to-b from-[#0b0f14] to-[#111827]"
    >
      <div className="absolute top-8">
        <div className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm">
          <i className="fa-solid fa-wand-magic-sparkles text-xs text-blue-400"></i>
          <span className="text-xs text-gray-400 font-medium">Mode: Supportive Coach</span>
        </div>
      </div>

      <div className="relative z-10 mb-16 animate-breathe">
        <RexOrb mode={mode} intensity={intensity} />
        <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full -z-10"></div>
      </div>

      <div className="text-center space-y-2 mb-12">
        <p className="text-2xl font-light text-white tracking-tight">{statusText}</p>
        <p className="text-sm text-gray-400">Speak naturally, take your time.</p>
      </div>

      <div className="absolute bottom-12 w-full flex flex-col items-center space-y-8">
        <div className="relative group">
          <button
            className="w-20 h-20 rounded-full bg-white text-black border border-white/80 flex items-center justify-center shadow-[0_0_55px_rgba(255,255,255,0.35)] hover:scale-105 transition-all duration-300 z-20 relative"
            onClick={onMicClick}
            disabled={micBusy}
          >
            <i className="fa-solid fa-microphone text-2xl"></i>
          </button>
          <div className="absolute inset-0 border border-white/10 rounded-full scale-110 animate-pulse"></div>
          <div className="absolute inset-0 border border-white/5 rounded-full scale-125"></div>
        </div>

        <div className="flex items-center bg-gray-900/50 p-1 rounded-full border border-white/5">
          <button className="px-4 py-1.5 rounded-full bg-gray-800 text-white text-xs font-medium shadow-sm transition-all">
            Hands-Free
          </button>
          <button className="px-4 py-1.5 rounded-full text-gray-500 hover:text-gray-300 text-xs font-medium transition-all">
            Push-to-Talk
          </button>
        </div>

        <div className="flex items-center space-x-8 pt-4">
          <button className="text-gray-600 hover:text-white transition-colors" title="Mute Microphone">
            <i className="fa-solid fa-microphone-slash text-lg"></i>
          </button>
          <button className="text-gray-600 hover:text-white transition-colors" title="Keyboard Input">
            <i className="fa-regular fa-keyboard text-lg"></i>
          </button>
        </div>
      </div>

      <div data-testid="interview-session-state" className={showDebug ? 'sr-only not-sr-only' : 'hidden'}>
        {debugState}
      </div>
    </section>
  );
}
