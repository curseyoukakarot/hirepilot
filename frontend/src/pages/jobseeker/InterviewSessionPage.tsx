import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import TranscriptPanel, { type CoachingCard, type TranscriptTurn } from '../../components/interview/TranscriptPanel';
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

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')
    ? 'https://api.thehirepilot.com'
    : 'http://localhost:8080');

export default function InterviewSessionPage() {
  const { id } = useParams();
  const location = useLocation();
  const debugEnabled = useMemo(() => new URLSearchParams(location.search).get('debug') === '1', [location.search]);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState<number | null>(null);
  const [coaching, setCoaching] = useState<CoachingCard | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([
    {
      id: 'seed-rex-1',
      speaker: 'rex',
      text: "Let's start with a classic product question. Tell me about a time you had to make a difficult prioritization decision where stakeholders were conflicted. How did you handle it?",
      timestamp: 'Now',
    },
  ]);
  const { currentState, transition } = useInterviewSessionMachine('IDLE');
  const { stream: userStream, request, isRequesting, micStatus } = useUserMedia();
  const activeUserTurnIdRef = useRef<string | null>(null);
  const activeRexTurnIdRef = useRef<string | null>(null);

  const makeTurnId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nowLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const roleTitle = 'Senior Product Manager';
  const company = 'Spotify';
  const level = 'senior';

  const generateCoaching = async (answer: string) => {
    const lastQuestion = [...turns].reverse().find((turn) => turn.speaker === 'rex' && !turn.partial);
    if (!lastQuestion || !answer.trim()) return;
    try {
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/${encodeURIComponent(id || 'test')}/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role_title: roleTitle,
          company,
          level,
          mode: 'supportive',
          question: lastQuestion.text,
          answer,
        }),
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (payload?.coaching) setCoaching(payload.coaching as CoachingCard);
    } catch {
      // No-op: coaching is additive.
    }
  };

  const voiceSession = useVoiceSession({
    onUserSpeechStart: () => transition('USER_SPEECH_START'),
    onUserSpeechEnd: () => transition('USER_SPEECH_END'),
    onRexThinkStart: () => transition('REX_THINK_START'),
    onRexThinkEnd: () => transition('REX_THINK_END'),
    onRexAudioStart: () => transition('REX_SPEECH_START'),
    onRexAudioEnd: () => transition('REX_SPEECH_END'),
    onUserTranscriptPartial: (text) => {
      if (!text) return;
      if (!activeUserTurnIdRef.current) {
        const id = makeTurnId();
        activeUserTurnIdRef.current = id;
        setTurns((prev) => [...prev, { id, speaker: 'user', text, timestamp: 'Now', partial: true }]);
        return;
      }
      setTurns((prev) =>
        prev.map((turn) => (turn.id === activeUserTurnIdRef.current ? { ...turn, text, partial: true, timestamp: 'Now' } : turn))
      );
    },
    onUserTranscriptFinal: (text) => {
      if (!text) return;
      if (!activeUserTurnIdRef.current) {
        const id = makeTurnId();
        setTurns((prev) => [...prev, { id, speaker: 'user', text, timestamp: nowLabel(), partial: false }]);
        void generateCoaching(text);
        return;
      }
      const turnId = activeUserTurnIdRef.current;
      setTurns((prev) => prev.map((turn) => (turn.id === turnId ? { ...turn, text, partial: false, timestamp: nowLabel() } : turn)));
      activeUserTurnIdRef.current = null;
      void generateCoaching(text);
    },
    onRexTranscriptPartial: (text) => {
      if (!text) return;
      if (!activeRexTurnIdRef.current) {
        const id = makeTurnId();
        activeRexTurnIdRef.current = id;
        setTurns((prev) => [...prev, { id, speaker: 'rex', text, timestamp: 'Now', partial: true }]);
        return;
      }
      setTurns((prev) =>
        prev.map((turn) => (turn.id === activeRexTurnIdRef.current ? { ...turn, text, partial: true, timestamp: 'Now' } : turn))
      );
    },
    onRexTranscriptFinal: (text) => {
      if (!text) return;
      if (!activeRexTurnIdRef.current) {
        const id = makeTurnId();
        setTurns((prev) => [...prev, { id, speaker: 'rex', text, timestamp: nowLabel(), partial: false }]);
        return;
      }
      const turnId = activeRexTurnIdRef.current;
      setTurns((prev) => prev.map((turn) => (turn.id === turnId ? { ...turn, text, partial: false, timestamp: nowLabel() } : turn)));
      activeRexTurnIdRef.current = null;
    },
  });
  const userAnalyzer = useAudioAnalyzer(userStream, { fftSize: 256, autoStart: true });
  const rexAnalyzer = useAudioAnalyzer(voiceSession.rexStream, { fftSize: 256, autoStart: true });
  const enterSpeakingTimerRef = useRef<number | null>(null);
  const exitSpeakingTimerRef = useRef<number | null>(null);
  const testPulseRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (userStream) transition('START_SESSION');
  }, [transition, userStream]);

  useEffect(() => {
    if (!userAnalyzer.isActive) return;
    if (currentState === 'REX_SPEAKING' || currentState === 'REX_THINKING') return;
    if (currentState !== 'USER_SPEAKING') {
      if (userAnalyzer.intensity >= 0.1 && !enterSpeakingTimerRef.current) {
        enterSpeakingTimerRef.current = window.setTimeout(() => {
          transition('USER_SPEECH_START');
          enterSpeakingTimerRef.current = null;
        }, 120);
      }
      if (userAnalyzer.intensity < 0.1 && enterSpeakingTimerRef.current) {
        window.clearTimeout(enterSpeakingTimerRef.current);
        enterSpeakingTimerRef.current = null;
      }
      if (exitSpeakingTimerRef.current) {
        window.clearTimeout(exitSpeakingTimerRef.current);
        exitSpeakingTimerRef.current = null;
      }
      return;
    }

    if (userAnalyzer.intensity <= 0.06 && !exitSpeakingTimerRef.current) {
      exitSpeakingTimerRef.current = window.setTimeout(() => {
        transition('USER_SPEECH_END');
        exitSpeakingTimerRef.current = null;
      }, 250);
    }
    if (userAnalyzer.intensity > 0.06 && exitSpeakingTimerRef.current) {
      window.clearTimeout(exitSpeakingTimerRef.current);
      exitSpeakingTimerRef.current = null;
    }
  }, [currentState, transition, userAnalyzer.intensity, userAnalyzer.isActive]);

  useEffect(() => {
    return () => {
      if (enterSpeakingTimerRef.current) window.clearTimeout(enterSpeakingTimerRef.current);
      if (exitSpeakingTimerRef.current) window.clearTimeout(exitSpeakingTimerRef.current);
      if (testPulseRafRef.current) cancelAnimationFrame(testPulseRafRef.current);
    };
  }, []);

  const orbMode = useMemo<'idle' | 'user' | 'rex'>(() => {
    if (pulseIntensity !== null) return 'user';
    if (currentState === 'USER_SPEAKING') return 'user';
    if (currentState === 'REX_SPEAKING') return 'rex';
    return 'idle';
  }, [currentState, pulseIntensity]);

  const orbIntensity =
    pulseIntensity !== null
      ? pulseIntensity
      : orbMode === 'user'
        ? userAnalyzer.intensity
        : orbMode === 'rex'
          ? rexAnalyzer.intensity
          : 0;

  const handleMicClick = async () => {
    try {
      const grantedStream = userStream || (await request());
      await userAnalyzer.start(grantedStream);
      if (!voiceSession.connected && !voiceSession.isConnecting) {
        await voiceSession.connect(grantedStream);
        transition('START_SESSION');
      }
    } catch {}
  };

  const runTestPulse = () => {
    if (!debugEnabled) return;
    if (testPulseRafRef.current) cancelAnimationFrame(testPulseRafRef.current);
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = t <= 0.5 ? t * 2 : (1 - t) * 2;
      setPulseIntensity(next);
      if (t < 1) {
        testPulseRafRef.current = requestAnimationFrame(tick);
      } else {
        setPulseIntensity(null);
        testPulseRafRef.current = null;
      }
    };
    testPulseRafRef.current = requestAnimationFrame(tick);
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
        <TranscriptPanel
          turns={turns}
          currentQuestion={Math.max(1, turns.filter((t) => t.speaker === 'rex').length)}
          totalQuestions={8}
          coaching={coaching}
        />
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
      {debugEnabled ? (
        <div className="fixed left-4 top-20 z-[60] rounded-lg border border-white/15 bg-black/65 px-3 py-2 text-xs text-gray-100 font-mono pointer-events-none">
          <div>state: {currentState}</div>
          <div>userIntensity: {userAnalyzer.intensity.toFixed(2)}</div>
          <div>rexIntensity: {rexAnalyzer.intensity.toFixed(2)}</div>
          <div>mic: {micStatus}</div>
          <div>analyzerActive: {String(userAnalyzer.isActive)}</div>
          <div>hz: {userAnalyzer.updateRate.toFixed(0)}</div>
          <div>noiseFloor: {userAnalyzer.noiseFloor.toFixed(3)}</div>
          <div>gain: {userAnalyzer.gain.toFixed(2)}</div>
          <div>shaped: {userAnalyzer.shapedIntensity.toFixed(2)}</div>
          <div>smoothed: {userAnalyzer.smoothedIntensity.toFixed(2)}</div>
          <div>speakingDetected: {String(userAnalyzer.speakingDetected)}</div>
          <button
            type="button"
            onClick={runTestPulse}
            className="mt-2 pointer-events-auto rounded border border-white/25 px-2 py-1 text-[11px] text-white hover:bg-white/10"
          >
            Test Pulse
          </button>
        </div>
      ) : null}
    </div>
  );
}
