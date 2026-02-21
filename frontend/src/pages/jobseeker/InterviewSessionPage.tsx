import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import TranscriptPanel from '../../components/interview/TranscriptPanel';
import VoiceStage from '../../components/interview/VoiceStage';
import { useInterviewSessionMachine } from '../../hooks/useInterviewSessionMachine';
import { useUserMedia } from '../../hooks/useUserMedia';
import { useAudioAnalyzer } from '../../hooks/useAudioAnalyzer';
import { useVoiceSession } from '../../hooks/useVoiceSession';

function statusLabelFromState(state: string) {
  if (state === 'USER_LISTENING') return 'REX is listening...';
  if (state === 'USER_SPEAKING') return 'Listening...';
  if (state === 'REX_THINKING') return 'REX is thinking...';
  if (state === 'REX_SPEAKING') return 'REX is speaking...';
  return 'REX is listening...';
}

export default function InterviewSessionPage() {
  const { id } = useParams();
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const { currentState, transition } = useInterviewSessionMachine('IDLE');
  const { stream: userStream, request, isRequesting } = useUserMedia();
  const voiceSession = useVoiceSession({
    onRexThinkStart: () => transition('REX_THINK_START'),
    onRexThinkEnd: () => transition('REX_THINK_END'),
    onRexAudioStart: () => transition('REX_SPEECH_START'),
    onRexAudioEnd: () => transition('REX_SPEECH_END'),
  });
  const userAnalyzer = useAudioAnalyzer(userStream, { fftSize: 256, autoStart: true });
  const rexAnalyzer = useAudioAnalyzer(voiceSession.rexStream, { fftSize: 256, autoStart: true });

  useEffect(() => {
    if (userStream) transition('START_SESSION');
  }, [transition, userStream]);

  const orbMode = useMemo<'idle' | 'user' | 'rex'>(() => {
    if (currentState === 'USER_SPEAKING') return 'user';
    if (currentState === 'REX_SPEAKING') return 'rex';
    return 'idle';
  }, [currentState]);

  const orbIntensity = orbMode === 'user' ? userAnalyzer.intensity : orbMode === 'rex' ? rexAnalyzer.intensity : 0;

  const handleMicClick = async () => {
    try {
      if (!userStream) await request();
      if (!voiceSession.connected && !voiceSession.isConnecting) {
        await voiceSession.connect();
        transition('START_SESSION');
      } else {
        voiceSession.triggerStubRexSpeech();
      }
    } catch {}
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0b0f14] text-gray-200">
      <style>{`
        .glass-panel {
          background: rgba(20, 20, 20, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .orb-container {
          position: relative;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(
            circle at 30% 30%,
            rgba(82, 135, 255, 0.58),
            rgba(124, 58, 237, 0.24) 60%,
            rgba(0, 0, 0, 0) 70%
          );
          box-shadow: 0 0 95px rgba(59, 130, 246, 0.35);
        }
        .orb-core {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(125, 175, 255, 0.4) 0%, rgba(37, 99, 235, 0.12) 50%, transparent 80%);
          filter: blur(20px);
        }
        .waveform-bar {
          width: 4px;
          background: rgba(255, 255, 255, 0.75);
          border-radius: 99px;
          animation: wave 1.2s ease-in-out infinite;
        }
        @keyframes wave {
          0%, 100% { height: 10%; }
          50% { height: 100%; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.86; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        .animate-breathe {
          animation: breathe 6s ease-in-out infinite;
        }
        .transcript-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .transcript-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .transcript-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.18);
          border-radius: 20px;
        }
      `}</style>
      <header id="header" className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#050505] z-50">
        <div className="flex items-center flex-1 min-w-0">
          <span className="text-xs uppercase tracking-widest text-gray-500 font-medium truncate">
            <i className="fa-solid fa-microphone-lines mr-2"></i>Interview Helper
          </span>
        </div>
        <div className="hidden md:flex flex-col items-center justify-center flex-2 px-4 min-w-0">
          <h1 className="text-sm font-medium text-gray-200 tracking-wide truncate max-w-full">
            Senior Product Manager <span className="text-gray-600 mx-2">•</span> <span className="text-gray-400">Spotify</span>
          </h1>
        </div>
        <div className="flex items-center justify-end space-x-3 md:space-x-6 flex-1">
          <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-mono text-gray-300">14:22</span>
          </div>
          <button className="text-gray-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 shrink-0">
            <i className="fa-solid fa-sliders text-sm"></i>
          </button>
          <button
            id="end-session-trigger"
            className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded-full hover:bg-red-500/10 group flex items-center gap-2 shrink-0"
            onClick={() => setShowEndSessionModal(true)}
          >
            <span className="text-xs hidden sm:inline-block font-medium">End Session</span>
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        <VoiceStage
          statusText={statusLabelFromState(currentState)}
          mode={orbMode}
          intensity={orbIntensity}
          onMicClick={handleMicClick}
          micBusy={isRequesting || voiceSession.isConnecting}
          debugState={currentState}
          showDebug={false}
        />
        <TranscriptPanel />
      </main>

      <div
        id="end-session-modal"
        className={`${showEndSessionModal ? '' : 'hidden'} fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md`}
        onClick={(e) => e.target === e.currentTarget && setShowEndSessionModal(false)}
      >
        <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-white mb-2">Prep Pack Ready</h2>
            <p className="text-gray-400 text-sm">Great session! Here&apos;s your performance summary.</p>
          </div>
          <div className="space-y-3">
            <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors">
              View Full Prep Pack
            </button>
            <button
              className="w-full py-3 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white rounded-xl font-medium transition-colors"
              onClick={() => {
                setShowEndSessionModal(false);
                transition('RESET');
              }}
            >
              Practice Again
            </button>
          </div>
        </div>
      </div>
      <div className="hidden" data-session-id={id || ''}></div>
    </div>
  );
}
