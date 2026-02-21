import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import TranscriptPanel, { type CoachingCard, type TranscriptTurn } from '../../components/interview/TranscriptPanel';
import VoiceStage from '../../components/interview/VoiceStage';
import { useInterviewSessionMachine } from '../../hooks/useInterviewSessionMachine';
import { useUserMedia } from '../../hooks/useUserMedia';
import { useAudioAnalyzer } from '../../hooks/useAudioAnalyzer';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { INTERVIEW_SEED_QUESTION } from '../../constants/interview';
import { supabase } from '../../lib/supabaseClient';

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
  const navigate = useNavigate();
  const debugEnabled = useMemo(() => new URLSearchParams(location.search).get('debug') === '1', [location.search]);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState<number | null>(null);
  const [coaching, setCoaching] = useState<CoachingCard | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [modalSummary, setModalSummary] = useState<{ scoreOutOf10: number; topStrength: string; focusArea: string } | null>(null);
  const [prepPackId, setPrepPackId] = useState<string | null>(null);
  const [isInvalidRouteId, setIsInvalidRouteId] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionRoleTitle, setSessionRoleTitle] = useState('Interview Practice Session');
  const [sessionCompany, setSessionCompany] = useState<string | null>(null);
  const [sessionLevel, setSessionLevel] = useState('senior');
  const [linkedPrepPackSummary, setLinkedPrepPackSummary] = useState<{ id: string; score: number; roleTitle: string } | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([
    {
      id: 'seed-rex-1',
      speaker: 'rex',
      text: INTERVIEW_SEED_QUESTION,
      timestamp: 'Now',
      turnIndex: 1,
    },
  ]);
  const { currentState, transition } = useInterviewSessionMachine('IDLE');
  const { stream: userStream, request, isRequesting, micStatus } = useUserMedia();
  const activeUserTurnIdRef = useRef<string | null>(null);
  const activeRexTurnIdRef = useRef<string | null>(null);
  const turnsRef = useRef<TranscriptTurn[]>(turns);
  const sessionIdRef = useRef<string | null>(null);
  const accessTokenRef = useRef<string>('');
  const initializedRef = useRef(false);
  const currentQuestionIndexRef = useRef(1);

  const makeTurnId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nowLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const withAuthHeaders = async (base: Record<string, string> = {}) => {
    let token = accessTokenRef.current;
    if (!token) {
      const auth = await supabase.auth.getSession().catch(() => null);
      token = auth?.data?.session?.access_token || '';
      if (token) accessTokenRef.current = token;
    }
    return {
      ...base,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const persistTurn = async (payload: {
    turn_index: number;
    speaker: 'rex' | 'user';
    question_text?: string;
    answer_text?: string;
    coaching?: any;
  }) => {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) return;
    const headers = await withAuthHeaders({ 'Content-Type': 'application/json' });
    await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions/${encodeURIComponent(activeSessionId)}/turns`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const boot = async () => {
      const routeId = String(id || '').trim();
      if (!routeId || !isUuid(routeId)) {
        setIsInvalidRouteId(true);
        navigate('/interview-helper', { replace: true });
        return;
      }
      setIsInvalidRouteId(false);
      setLoadError(null);
      const auth = await supabase.auth.getSession().catch(() => null);
      if (!auth?.data?.session) {
        setLoadError('Please sign in to continue this interview session.');
        return;
      }
      accessTokenRef.current = auth.data.session.access_token || '';
      setSessionId(routeId);
      const sessionHeaders = await withAuthHeaders();
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/sessions/${encodeURIComponent(routeId)}`, {
        headers: sessionHeaders,
        credentials: 'include',
      }).catch(() => null);
      if (!response?.ok) {
        setLoadError('This interview session is unavailable or you do not have access.');
        return;
      }
      const payload = await response.json().catch(() => null);
      const loadedSession = payload?.session || {};
      setSessionRoleTitle(String(loadedSession?.role_title || 'Interview Practice Session'));
      setSessionCompany(loadedSession?.company ? String(loadedSession.company) : null);
      setSessionLevel(String(loadedSession?.level || 'senior'));
      const linkedPrepPackId = String(payload?.session?.prep_pack_id || '').trim();
      if (linkedPrepPackId) {
        setPrepPackId(linkedPrepPackId);
        const prepHeaders = await withAuthHeaders();
        const prepResponse = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/prep/${encodeURIComponent(linkedPrepPackId)}`, {
          headers: prepHeaders,
          credentials: 'include',
        }).catch(() => null);
        const prepPayload = prepResponse?.ok ? await prepResponse.json().catch(() => null) : null;
        if (prepPayload?.prepPack?.id) {
          setLinkedPrepPackSummary({
            id: prepPayload.prepPack.id,
            score: Number(prepPayload.prepPack?.overall_score?.out_of_10 || 0),
            roleTitle: String(prepPayload?.session?.role_title || 'Interview Prep'),
          });
        }
      }
      const dbTurns = Array.isArray(payload?.turns) ? payload.turns : [];
      const hydrated: TranscriptTurn[] = dbTurns
        .map((row: any) => {
          const text = row.speaker === 'rex' ? row.question_text : row.answer_text;
          if (!text) return null;
          return {
            id: row.id,
            speaker: row.speaker,
            text,
            timestamp: nowLabel(),
            partial: false,
            turnIndex: row.turn_index,
          } as TranscriptTurn;
        })
        .filter(Boolean);
      if (hydrated.length) {
        setTurns(hydrated);
        currentQuestionIndexRef.current = Math.max(
          1,
          ...hydrated.filter((turn) => turn.speaker === 'rex').map((turn) => turn.turnIndex || 1)
        );
      }
      const latestCoach = [...dbTurns].reverse().find((row: any) => row.speaker === 'user' && row.coaching);
      if (latestCoach?.coaching) setCoaching(latestCoach.coaching as CoachingCard);
    };
    void boot();
  }, [id, navigate]);

  const generateCoaching = async (answer: string, turnIndex: number) => {
    const lastQuestion = [...turnsRef.current].reverse().find((turn) => turn.speaker === 'rex' && !turn.partial);
    if (!lastQuestion || !answer.trim()) return;
    try {
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) return;
      const headers = await withAuthHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/interview/${encodeURIComponent(activeSessionId)}/coach`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          role_title: sessionRoleTitle,
          company: sessionCompany || 'Target Company',
          level: sessionLevel,
          mode: 'supportive',
          question: lastQuestion.text,
          answer,
        }),
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (payload?.coaching) {
        setCoaching(payload.coaching as CoachingCard);
        await persistTurn({
          turn_index: turnIndex,
          speaker: 'user',
          answer_text: answer,
          coaching: payload.coaching,
        });
      }
    } catch {
      // No-op: coaching is additive.
    }
  };

  const voiceSession = useVoiceSession({
    sessionId,
    onUserSpeechStart: () => transition('USER_SPEECH_START'),
    onUserSpeechEnd: () => transition('USER_SPEECH_END'),
    onRexThinkStart: () => transition('REX_THINK_START'),
    onRexThinkEnd: () => transition('REX_THINK_END'),
    onRexAudioStart: () => transition('REX_SPEECH_START'),
    onRexAudioEnd: () => transition('REX_SPEECH_END'),
    onUserTranscriptPartial: (text) => {
      if (!text) return;
      if (!activeUserTurnIdRef.current) {
        const turnId = makeTurnId();
        activeUserTurnIdRef.current = turnId;
        const turnIndex = currentQuestionIndexRef.current;
        setTurns((prev) => [...prev, { id: turnId, speaker: 'user', text, timestamp: 'Now', partial: true, turnIndex }]);
        return;
      }
      setTurns((prev) =>
        prev.map((turn) => (turn.id === activeUserTurnIdRef.current ? { ...turn, text, partial: true, timestamp: 'Now' } : turn))
      );
    },
    onUserTranscriptFinal: (text) => {
      if (!text) return;
      if (!activeUserTurnIdRef.current) {
        const turnId = makeTurnId();
        const turnIndex = currentQuestionIndexRef.current;
        setTurns((prev) => [...prev, { id: turnId, speaker: 'user', text, timestamp: nowLabel(), partial: false, turnIndex }]);
        void persistTurn({ turn_index: turnIndex, speaker: 'user', answer_text: text });
        void generateCoaching(text, turnIndex);
        return;
      }
      const turnId = activeUserTurnIdRef.current;
      const finalizedTurn = turnsRef.current.find((turn) => turn.id === turnId);
      const turnIndex = finalizedTurn?.turnIndex || currentQuestionIndexRef.current;
      setTurns((prev) =>
        prev.map((turn) => (turn.id === turnId ? { ...turn, text, partial: false, timestamp: nowLabel(), turnIndex } : turn))
      );
      activeUserTurnIdRef.current = null;
      void persistTurn({ turn_index: turnIndex, speaker: 'user', answer_text: text });
      void generateCoaching(text, turnIndex);
    },
    onRexTranscriptPartial: (text) => {
      if (!text) return;
      if (!activeRexTurnIdRef.current) {
        const turnId = makeTurnId();
        activeRexTurnIdRef.current = turnId;
        const nextTurnIndex = currentQuestionIndexRef.current + 1;
        setTurns((prev) => [...prev, { id: turnId, speaker: 'rex', text, timestamp: 'Now', partial: true, turnIndex: nextTurnIndex }]);
        return;
      }
      setTurns((prev) =>
        prev.map((turn) => (turn.id === activeRexTurnIdRef.current ? { ...turn, text, partial: true, timestamp: 'Now' } : turn))
      );
    },
    onRexTranscriptFinal: (text) => {
      if (!text) return;
      if (!activeRexTurnIdRef.current) {
        const turnId = makeTurnId();
        const turnIndex = currentQuestionIndexRef.current + 1;
        setTurns((prev) => [...prev, { id: turnId, speaker: 'rex', text, timestamp: nowLabel(), partial: false, turnIndex }]);
        currentQuestionIndexRef.current = turnIndex;
        void persistTurn({ turn_index: turnIndex, speaker: 'rex', question_text: text });
        return;
      }
      const turnId = activeRexTurnIdRef.current;
      const existing = turnsRef.current.find((turn) => turn.id === turnId);
      const turnIndex = existing?.turnIndex || currentQuestionIndexRef.current + 1;
      setTurns((prev) =>
        prev.map((turn) => (turn.id === turnId ? { ...turn, text, partial: false, timestamp: nowLabel(), turnIndex } : turn))
      );
      activeRexTurnIdRef.current = null;
      currentQuestionIndexRef.current = turnIndex;
      void persistTurn({ turn_index: turnIndex, speaker: 'rex', question_text: text });
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

  const handleFinalize = async () => {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) {
      setShowEndSessionModal(true);
      return;
    }
    try {
      const headers = await withAuthHeaders();
      const response = await fetch(
        `${API_BASE.replace(/\/$/, '')}/api/interview/sessions/${encodeURIComponent(activeSessionId)}/finalize`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
        }
      );
      const payload = await response.json().catch(() => null);
      if (response.ok && payload) {
        setPrepPackId(payload.prepPackId || null);
        setModalSummary(payload.modalSummary || null);
      }
    } catch {
      // no-op
    } finally {
      setShowEndSessionModal(true);
    }
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

  if (isInvalidRouteId) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0b0f14] text-gray-300">
        Invalid session link. Start a new interview session.
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0b0f14] text-gray-300 gap-3">
        <div>{loadError}</div>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          onClick={() => navigate('/interview-helper')}
        >
          Back to Interview Helper
        </button>
      </div>
    );
  }

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
            {sessionRoleTitle}
            {sessionCompany ? (
              <>
                <span className="text-gray-600 mx-2">•</span> <span className="text-gray-400">{sessionCompany}</span>
              </>
            ) : null}
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
            onClick={handleFinalize}
          >
            <span className="text-xs hidden sm:inline-block font-medium">End Session</span>
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      </header>
      {linkedPrepPackSummary ? (
        <div className="mx-6 mt-3 rounded-lg border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs text-blue-100 flex items-center justify-between">
          <span>
            Linked prep pack: {linkedPrepPackSummary.roleTitle} ({linkedPrepPackSummary.score.toFixed(1)}/10)
          </span>
          <button
            type="button"
            className="text-blue-300 hover:text-blue-200"
            onClick={() => navigate(`/interview-helper/prep/${linkedPrepPackSummary.id}`)}
          >
            Open Prep Pack
          </button>
        </div>
      ) : null}

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
            <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between border border-white/5">
              <span className="text-gray-300 text-sm font-medium">Overall Score</span>
              <span className="text-2xl font-bold text-blue-400">
                {modalSummary?.scoreOutOf10?.toFixed?.(1) || '0.0'}
                <span className="text-sm text-gray-500 font-normal">/10</span>
              </span>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-sm text-gray-300">
              <div>
                <span className="text-gray-500">Top strength:</span> {modalSummary?.topStrength || 'Structured thinking'}
              </div>
              <div className="mt-1">
                <span className="text-gray-500">Focus area:</span> {modalSummary?.focusArea || 'Answer specificity'}
              </div>
            </div>
            <button
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
              onClick={() => {
                if (prepPackId) navigate(`/interview-helper/prep/${prepPackId}`);
              }}
            >
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
